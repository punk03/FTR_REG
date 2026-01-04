"""Events view component"""
import customtkinter as ctk
from typing import List, Dict, Any, Optional, Callable
from app.database.session import get_db_session
from app.database.models import Event, EventStatus
from app.utils.logger import logger


class EventsView(ctk.CTkFrame):
    """Events list view"""
    
    def __init__(self, parent, on_event_select: Optional[Callable[[int], None]] = None):
        super().__init__(parent)
        
        self.on_event_select = on_event_select
        self.events: List[Event] = []
        self.selected_event_id: Optional[int] = None
        
        # Configure grid
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)
        
        # Header frame
        header_frame = ctk.CTkFrame(self, fg_color="transparent")
        header_frame.grid(row=0, column=0, sticky="ew", padx=10, pady=10)
        header_frame.grid_columnconfigure(1, weight=1)
        
        # Title
        title_label = ctk.CTkLabel(
            header_frame,
            text="📅 События",
            font=ctk.CTkFont(size=24, weight="bold")
        )
        title_label.grid(row=0, column=0, sticky="w", padx=10, pady=10)
        
        # Refresh button
        refresh_btn = ctk.CTkButton(
            header_frame,
            text="🔄 Обновить",
            command=self.refresh_events,
            width=150,
            height=35,
            font=ctk.CTkFont(size=14, weight="bold")
        )
        refresh_btn.grid(row=0, column=1, sticky="e", padx=10, pady=10)
        
        # Events scrollable frame
        self.events_scrollable = ctk.CTkScrollableFrame(self)
        self.events_scrollable.grid(row=1, column=0, sticky="nsew", padx=10, pady=10)
        self.events_scrollable.grid_columnconfigure(0, weight=1)
        
        # Status label
        self.status_label = ctk.CTkLabel(
            self,
            text="",
            font=ctk.CTkFont(size=12)
        )
        self.status_label.grid(row=2, column=0, pady=5)
        
        # Load events
        self.refresh_events()
    
    def refresh_events(self):
        """Refresh events list"""
        self.status_label.configure(text="⏳ Загрузка событий...", text_color="gray")
        self.update()
        
        try:
            db = get_db_session()
            try:
                self.events = db.query(Event).order_by(Event.start_date.desc()).all()
                self._render_events()
                self.status_label.configure(
                    text=f"✓ Загружено событий: {len(self.events)}",
                    text_color="green"
                )
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error loading events: {e}")
            # Clear and show error
            for widget in self.events_scrollable.winfo_children():
                widget.destroy()
            error_label = ctk.CTkLabel(
                self.events_scrollable,
                text=f"❌ Ошибка загрузки событий: {e}",
                text_color="red",
                font=ctk.CTkFont(size=14)
            )
            error_label.pack(pady=20)
            self.status_label.configure(
                text=f"✗ Ошибка: {str(e)[:50]}",
                text_color="red"
            )
    
    def _render_events(self):
        """Render events list"""
        # Clear existing widgets
        for widget in self.events_scrollable.winfo_children():
            widget.destroy()
        
        if not self.events:
            no_events_label = ctk.CTkLabel(
                self.events_scrollable,
                text="📭 Нет событий.\nНажмите 'Синхронизировать' для загрузки данных с сервера.",
                font=ctk.CTkFont(size=16),
                wraplength=600,
                justify="center"
            )
            no_events_label.pack(pady=40)
            return
        
        # Create event cards with better performance
        for idx, event in enumerate(self.events):
            self._create_event_card(event, idx)
    
    def _create_event_card(self, event: Event, index: int):
        """Create event card"""
        card = ctk.CTkFrame(
            self.events_scrollable,
            corner_radius=10,
            border_width=1,
            border_color=("gray70", "gray30")
        )
        card.pack(fill="x", padx=5, pady=8)
        card.grid_columnconfigure(0, weight=1)
        
        # Top row: name and status
        top_row = ctk.CTkFrame(card, fg_color="transparent")
        top_row.grid(row=0, column=0, sticky="ew", padx=15, pady=(15, 5))
        top_row.grid_columnconfigure(0, weight=1)
        
        # Event name
        name_label = ctk.CTkLabel(
            top_row,
            text=event.name,
            font=ctk.CTkFont(size=18, weight="bold"),
            anchor="w"
        )
        name_label.grid(row=0, column=0, sticky="ew", padx=0, pady=0)
        
        # Status badge
        status_colors = {
            "DRAFT": ("gray", "gray"),
            "ACTIVE": ("green", "darkgreen"),
            "ARCHIVED": ("orange", "darkorange")
        }
        status_labels = {
            "DRAFT": "📝 Черновик",
            "ACTIVE": "✅ Активно",
            "ARCHIVED": "📦 Архив"
        }
        status_color = status_colors.get(event.status.value if event.status else "DRAFT", ("gray", "gray"))
        status_label_text = status_labels.get(event.status.value if event.status else "DRAFT", "Неизвестно")
        
        status_badge = ctk.CTkLabel(
            top_row,
            text=status_label_text,
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color=status_color[1],
            text_color="white",
            corner_radius=15,
            width=120,
            height=30
        )
        status_badge.grid(row=0, column=1, padx=(10, 0), pady=0, sticky="e")
        
        # Event dates
        start_date = event.start_date.strftime("%d.%m.%Y") if event.start_date else "N/A"
        end_date = event.end_date.strftime("%d.%m.%Y") if event.end_date else "N/A"
        dates_label = ctk.CTkLabel(
            card,
            text=f"📆 С {start_date} по {end_date}",
            font=ctk.CTkFont(size=14),
            anchor="w",
            text_color=("gray60", "gray40")
        )
        dates_label.grid(row=1, column=0, sticky="ew", padx=15, pady=5)
        
        # Select button
        select_btn = ctk.CTkButton(
            card,
            text="👉 Выбрать",
            command=lambda e=event: self._select_event(e),
            width=150,
            height=40,
            font=ctk.CTkFont(size=14, weight="bold"),
            corner_radius=8
        )
        select_btn.grid(row=2, column=0, padx=15, pady=(10, 15), sticky="e")
        select_btn.lift()  # Ensure button is on top
    
    def _select_event(self, event: Event):
        """Select event"""
        self.selected_event_id = event.server_id or event.id
        if self.on_event_select:
            self.on_event_select(self.selected_event_id)

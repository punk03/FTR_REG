"""Events view component"""
import customtkinter as ctk
from typing import List, Dict, Any, Optional, Callable
from app.database.session import get_db_session
from app.database.models import Event, EventStatus
from app.utils.logger import logger


class EventsView(ctk.CTkScrollableFrame):
    """Events list view"""
    
    def __init__(self, parent, on_event_select: Optional[Callable[[int], None]] = None):
        super().__init__(parent)
        
        self.on_event_select = on_event_select
        self.events: List[Event] = []
        self.selected_event_id: Optional[int] = None
        
        # Header
        header = ctk.CTkLabel(
            self,
            text="События",
            font=ctk.CTkFont(size=20, weight="bold")
        )
        header.pack(pady=10)
        
        # Refresh button
        refresh_btn = ctk.CTkButton(
            self,
            text="Обновить",
            command=self.refresh_events,
            width=150
        )
        refresh_btn.pack(pady=10)
        
        # Events list frame
        self.events_frame = ctk.CTkFrame(self)
        self.events_frame.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Load events
        self.refresh_events()
    
    def refresh_events(self):
        """Refresh events list"""
        try:
            db = get_db_session()
            try:
                self.events = db.query(Event).order_by(Event.start_date.desc()).all()
                self._render_events()
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error loading events: {e}")
            error_label = ctk.CTkLabel(
                self.events_frame,
                text=f"Ошибка загрузки событий: {e}",
                text_color="red"
            )
            error_label.pack(pady=20)
    
    def _render_events(self):
        """Render events list"""
        # Clear existing widgets
        for widget in self.events_frame.winfo_children():
            widget.destroy()
        
        if not self.events:
            no_events_label = ctk.CTkLabel(
                self.events_frame,
                text="Нет событий. Синхронизируйтесь с сервером.",
                font=ctk.CTkFont(size=14)
            )
            no_events_label.pack(pady=20)
            return
        
        # Create event cards
        for event in self.events:
            self._create_event_card(event)
    
    def _create_event_card(self, event: Event):
        """Create event card"""
        card = ctk.CTkFrame(self.events_frame)
        card.pack(fill="x", padx=5, pady=5)
        
        # Event name
        name_label = ctk.CTkLabel(
            card,
            text=event.name,
            font=ctk.CTkFont(size=16, weight="bold"),
            anchor="w"
        )
        name_label.pack(fill="x", padx=10, pady=(10, 5))
        
        # Event dates
        start_date = event.start_date.strftime("%d.%m.%Y") if event.start_date else "N/A"
        end_date = event.end_date.strftime("%d.%m.%Y") if event.end_date else "N/A"
        dates_label = ctk.CTkLabel(
            card,
            text=f"С {start_date} по {end_date}",
            font=ctk.CTkFont(size=12),
            anchor="w"
        )
        dates_label.pack(fill="x", padx=10, pady=5)
        
        # Status
        status_colors = {
            "DRAFT": "gray",
            "ACTIVE": "green",
            "ARCHIVED": "orange"
        }
        status_color = status_colors.get(event.status.value if event.status else "DRAFT", "gray")
        status_label = ctk.CTkLabel(
            card,
            text=f"Статус: {event.status.value if event.status else 'DRAFT'}",
            font=ctk.CTkFont(size=12),
            text_color=status_color,
            anchor="w"
        )
        status_label.pack(fill="x", padx=10, pady=5)
        
        # Select button
        select_btn = ctk.CTkButton(
            card,
            text="Выбрать",
            command=lambda e=event: self._select_event(e),
            width=100
        )
        select_btn.pack(padx=10, pady=10, anchor="e")
    
    def _select_event(self, event: Event):
        """Select event"""
        self.selected_event_id = event.server_id or event.id
        if self.on_event_select:
            self.on_event_select(self.selected_event_id)


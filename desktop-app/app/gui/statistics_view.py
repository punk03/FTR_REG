"""Statistics view for displaying event statistics"""
import customtkinter as ctk
from typing import Optional, Dict, Any
from app.database.models import Event, Registration, RegistrationStatus, PaymentStatus
from app.database.session import get_db_session
from app.utils.logger import logger
from sqlalchemy import func


class StatisticsView(ctk.CTkFrame):
    """View for displaying statistics"""
    
    def __init__(self, parent, event_id: Optional[int] = None):
        super().__init__(parent)
        self.event_id = event_id
        
        # Configure grid
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)
        
        # Header frame
        header_frame = ctk.CTkFrame(self, fg_color="transparent")
        header_frame.grid(row=0, column=0, sticky="ew", padx=10, pady=10)
        header_frame.grid_columnconfigure(1, weight=1)
        
        # Title
        title_label = ctk.CTkLabel(
            header_frame,
            text="📊 Статистика",
            font=ctk.CTkFont(size=24, weight="bold")
        )
        title_label.grid(row=0, column=0, sticky="w", padx=10, pady=10)
        
        # Controls frame
        controls_frame = ctk.CTkFrame(self)
        controls_frame.grid(row=1, column=0, sticky="ew", padx=10, pady=5)
        controls_frame.grid_columnconfigure(1, weight=1)
        
        # Event selector
        ctk.CTkLabel(
            controls_frame,
            text="Событие:",
            font=ctk.CTkFont(size=14, weight="bold")
        ).grid(row=0, column=0, padx=5, pady=5, sticky="w")
        
        self.event_var = ctk.StringVar(value="Выберите событие")
        self.event_dropdown = ctk.CTkComboBox(
            controls_frame,
            values=["Загрузка..."],
            variable=self.event_var,
            command=self._on_event_selected,
            width=400,
            height=35,
            font=ctk.CTkFont(size=14)
        )
        self.event_dropdown.grid(row=0, column=1, padx=5, pady=5, sticky="ew")
        
        # Refresh button
        refresh_btn = ctk.CTkButton(
            controls_frame,
            text="🔄 Обновить",
            command=self.refresh_statistics,
            width=120,
            height=35,
            font=ctk.CTkFont(size=12),
            corner_radius=8
        )
        refresh_btn.grid(row=0, column=2, padx=5, pady=5, sticky="e")
        controls_frame.after(100, lambda: refresh_btn.lift())
        
        # Statistics scrollable frame
        self.scrollable_frame = ctk.CTkScrollableFrame(
            self,
            scrollbar_button_color=("gray70", "gray30"),
            scrollbar_button_hover_color=("gray60", "gray40")
        )
        self.scrollable_frame.grid(row=2, column=0, sticky="nsew", padx=10, pady=10)
        
        # Status label
        self.status_label = ctk.CTkLabel(
            self,
            text="",
            font=ctk.CTkFont(size=12)
        )
        self.status_label.grid(row=3, column=0, pady=5)
        
        # Load events
        self.refresh_events()
        if event_id:
            self.event_id = event_id
            self.refresh_statistics()
    
    def refresh_events(self):
        """Refresh events dropdown"""
        try:
            db = get_db_session()
            try:
                events = db.query(Event).filter(
                    Event.server_id.isnot(None)
                ).order_by(Event.start_date.desc()).all()
                
                event_values = ["Выберите событие"]
                for event in events:
                    event_values.append(f"{event.name} (ID: {event.server_id})")
                
                self.event_dropdown.configure(values=event_values)
                
                if self.event_id:
                    # Find and select current event
                    for event in events:
                        if event.server_id == self.event_id or event.id == self.event_id:
                            self.event_var.set(f"{event.name} (ID: {event.server_id})")
                            break
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error loading events: {e}")
    
    def _on_event_selected(self, choice: str):
        """Handle event selection"""
        if choice == "Выберите событие":
            self.event_id = None
            return
        
        try:
            event_id_str = choice.split("ID: ")[1].split(")")[0]
            self.event_id = int(event_id_str)
            self.refresh_statistics()
        except Exception as e:
            logger.error(f"Error parsing event ID: {e}")
    
    def refresh_statistics(self):
        """Refresh statistics"""
        # Clear existing widgets
        for widget in self.scrollable_frame.winfo_children():
            widget.destroy()
        
        if not self.event_id:
            self.status_label.configure(text="", text_color="gray")
            no_event_label = ctk.CTkLabel(
                self.scrollable_frame,
                text="📭 Выберите событие для просмотра статистики",
                font=ctk.CTkFont(size=16),
                justify="center"
            )
            no_event_label.pack(pady=40)
            return
        
        self.status_label.configure(text="⏳ Загрузка статистики...", text_color="gray")
        self.update()
        
        try:
            db = get_db_session()
            try:
                # Find local event ID from server ID
                event = db.query(Event).filter(
                    (Event.server_id == self.event_id) | (Event.id == self.event_id)
                ).first()
                
                if not event:
                    error_label = ctk.CTkLabel(
                        self.scrollable_frame,
                        text="❌ Событие не найдено в локальной БД.\nСинхронизируйтесь с сервером.",
                        text_color="red",
                        font=ctk.CTkFont(size=14),
                        wraplength=600,
                        justify="center"
                    )
                    error_label.pack(pady=20)
                    self.status_label.configure(text="✗ Событие не найдено", text_color="red")
                    return
                
                # Get statistics
                total_regs = db.query(Registration).filter(
                    Registration.event_id == event.id
                ).count()
                
                pending_regs = db.query(Registration).filter(
                    Registration.event_id == event.id,
                    Registration.status == RegistrationStatus.PENDING
                ).count()
                
                approved_regs = db.query(Registration).filter(
                    Registration.event_id == event.id,
                    Registration.status == RegistrationStatus.APPROVED
                ).count()
                
                rejected_regs = db.query(Registration).filter(
                    Registration.event_id == event.id,
                    Registration.status == RegistrationStatus.REJECTED
                ).count()
                
                unpaid_regs = db.query(Registration).filter(
                    Registration.event_id == event.id,
                    Registration.payment_status == PaymentStatus.UNPAID
                ).count()
                
                paid_regs = db.query(Registration).filter(
                    Registration.event_id == event.id,
                    Registration.payment_status == PaymentStatus.PAID
                ).count()
                
                total_participants = db.query(func.sum(Registration.participants_count)).filter(
                    Registration.event_id == event.id
                ).scalar() or 0
                
                self._render_statistics({
                    "total_regs": total_regs,
                    "pending_regs": pending_regs,
                    "approved_regs": approved_regs,
                    "rejected_regs": rejected_regs,
                    "unpaid_regs": unpaid_regs,
                    "paid_regs": paid_regs,
                    "total_participants": int(total_participants) if total_participants else 0,
                    "event_name": event.name
                })
                
                self.status_label.configure(
                    text="✓ Статистика загружена",
                    text_color="green"
                )
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error loading statistics: {e}")
            error_label = ctk.CTkLabel(
                self.scrollable_frame,
                text=f"❌ Ошибка загрузки статистики: {e}",
                text_color="red",
                font=ctk.CTkFont(size=14),
                wraplength=600
            )
            error_label.pack(pady=20)
            self.status_label.configure(
                text=f"✗ Ошибка: {str(e)[:50]}",
                text_color="red"
            )
    
    def _render_statistics(self, stats: Dict[str, Any]):
        """Render statistics"""
        # Event name
        event_frame = ctk.CTkFrame(
            self.scrollable_frame,
            corner_radius=10,
            fg_color=("gray75", "gray25")
        )
        event_frame.pack(fill="x", padx=5, pady=10)
        
        event_label = ctk.CTkLabel(
            event_frame,
            text=f"📅 {stats['event_name']}",
            font=ctk.CTkFont(size=18, weight="bold")
        )
        event_label.pack(pady=10, padx=10)
        
        # Statistics cards
        stats_cards = [
            ("📋 Всего регистраций", stats['total_regs'], "blue"),
            ("⏳ На рассмотрении", stats['pending_regs'], "yellow"),
            ("✅ Одобрено", stats['approved_regs'], "green"),
            ("❌ Отклонено", stats['rejected_regs'], "red"),
            ("💳 Не оплачено", stats['unpaid_regs'], "orange"),
            ("💰 Оплачено", stats['paid_regs'], "green"),
            ("👥 Всего участников", stats['total_participants'], "purple"),
        ]
        
        for title, value, color in stats_cards:
            card = ctk.CTkFrame(
                self.scrollable_frame,
                corner_radius=10,
                border_width=1,
                border_color=("gray70", "gray30")
            )
            card.pack(fill="x", padx=5, pady=5)
            
            title_label = ctk.CTkLabel(
                card,
                text=title,
                font=ctk.CTkFont(size=14),
                anchor="w"
            )
            title_label.pack(side="left", padx=15, pady=10)
            
            value_label = ctk.CTkLabel(
                card,
                text=str(value),
                font=ctk.CTkFont(size=20, weight="bold"),
                anchor="e"
            )
            value_label.pack(side="right", padx=15, pady=10)


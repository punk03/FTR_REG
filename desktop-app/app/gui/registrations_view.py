"""Registrations view component"""
import customtkinter as ctk
from typing import List, Dict, Any, Optional
from app.database.session import get_db_session
from app.database.models import Registration, Event
from app.utils.logger import logger


class RegistrationsView(ctk.CTkScrollableFrame):
    """Registrations list view"""
    
    def __init__(self, parent, event_id: Optional[int] = None):
        super().__init__(parent)
        
        self.event_id = event_id
        
        # Header
        header = ctk.CTkLabel(
            self,
            text="Регистрации",
            font=ctk.CTkFont(size=20, weight="bold")
        )
        header.pack(pady=10)
        
        # Event selector
        event_frame = ctk.CTkFrame(self)
        event_frame.pack(fill="x", padx=10, pady=10)
        
        ctk.CTkLabel(event_frame, text="Событие:").pack(side="left", padx=5)
        self.event_var = ctk.StringVar(value="Выберите событие")
        self.event_dropdown = ctk.CTkComboBox(
            event_frame,
            values=["Загрузка..."],
            variable=self.event_var,
            command=self._on_event_selected,
            width=300
        )
        self.event_dropdown.pack(side="left", padx=5)
        
        refresh_btn = ctk.CTkButton(
            event_frame,
            text="Обновить",
            command=self.refresh_registrations,
            width=100
        )
        refresh_btn.pack(side="left", padx=5)
        
        # Registrations table frame
        self.table_frame = ctk.CTkFrame(self)
        self.table_frame.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Load events for dropdown
        self._load_events()
        
        # Load registrations if event_id provided
        if event_id:
            self.event_id = event_id
            self.refresh_registrations()
    
    def _load_events(self):
        """Load events for dropdown"""
        try:
            db = get_db_session()
            try:
                events = db.query(Event).order_by(Event.start_date.desc()).all()
                event_names = [f"{e.name} (ID: {e.server_id or e.id})" for e in events]
                event_names.insert(0, "Выберите событие")
                self.event_dropdown.configure(values=event_names)
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error loading events: {e}")
    
    def _on_event_selected(self, choice: str):
        """Handle event selection"""
        if choice == "Выберите событие":
            self.event_id = None
            return
        
        # Extract event ID from choice
        try:
            event_id_str = choice.split("ID: ")[1].split(")")[0]
            self.event_id = int(event_id_str)
            self.refresh_registrations()
        except Exception as e:
            logger.error(f"Error parsing event ID: {e}")
    
    def refresh_registrations(self):
        """Refresh registrations list"""
        if not self.event_id:
            # Clear table
            for widget in self.table_frame.winfo_children():
                widget.destroy()
            no_event_label = ctk.CTkLabel(
                self.table_frame,
                text="Выберите событие для просмотра регистраций",
                font=ctk.CTkFont(size=14)
            )
            no_event_label.pack(pady=20)
            return
        
        try:
            db = get_db_session()
            try:
                # Find local event ID from server ID
                event = db.query(Event).filter(
                    (Event.server_id == self.event_id) | (Event.id == self.event_id)
                ).first()
                
                if not event:
                    error_label = ctk.CTkLabel(
                        self.table_frame,
                        text="Событие не найдено в локальной БД",
                        text_color="red"
                    )
                    error_label.pack(pady=20)
                    return
                
                registrations = db.query(Registration).filter(
                    Registration.event_id == event.id
                ).order_by(Registration.created_at.desc()).limit(100).all()
                
                self._render_registrations(registrations)
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error loading registrations: {e}")
            error_label = ctk.CTkLabel(
                self.table_frame,
                text=f"Ошибка загрузки регистраций: {e}",
                text_color="red"
            )
            error_label.pack(pady=20)
    
    def _render_registrations(self, registrations: List[Registration]):
        """Render registrations table"""
        # Clear existing widgets
        for widget in self.table_frame.winfo_children():
            widget.destroy()
        
        if not registrations:
            no_regs_label = ctk.CTkLabel(
                self.table_frame,
                text="Нет регистраций для этого события",
                font=ctk.CTkFont(size=14)
            )
            no_regs_label.pack(pady=20)
            return
        
        # Create table headers
        headers_frame = ctk.CTkFrame(self.table_frame)
        headers_frame.pack(fill="x", padx=5, pady=5)
        
        headers = ["№", "Коллектив", "Название", "Статус", "Оплата"]
        for i, header in enumerate(headers):
            label = ctk.CTkLabel(
                headers_frame,
                text=header,
                font=ctk.CTkFont(size=12, weight="bold"),
                width=150 if i > 0 else 50
            )
            label.grid(row=0, column=i, padx=5, pady=5, sticky="ew")
        
        headers_frame.grid_columnconfigure(1, weight=1)
        
        # Create registration rows
        for reg in registrations:
            self._create_registration_row(reg)
    
    def _create_registration_row(self, reg: Registration):
        """Create registration table row"""
        row_frame = ctk.CTkFrame(self.table_frame)
        row_frame.pack(fill="x", padx=5, pady=2)
        
        # Number
        number_label = ctk.CTkLabel(
            row_frame,
            text=str(reg.number or "-"),
            width=50
        )
        number_label.grid(row=0, column=0, padx=5, pady=5)
        
        # Collective name
        collective_name = "-"
        if reg.collective:
            collective_name = reg.collective.name
        collective_label = ctk.CTkLabel(
            row_frame,
            text=collective_name,
            width=150,
            anchor="w"
        )
        collective_label.grid(row=0, column=1, padx=5, pady=5, sticky="ew")
        
        # Dance name
        dance_label = ctk.CTkLabel(
            row_frame,
            text=reg.dance_name or "-",
            width=150,
            anchor="w"
        )
        dance_label.grid(row=0, column=2, padx=5, pady=5, sticky="ew")
        
        # Status
        status_colors = {
            "PENDING": "yellow",
            "APPROVED": "green",
            "REJECTED": "red"
        }
        status_color = status_colors.get(reg.status.value if reg.status else "PENDING", "gray")
        status_label = ctk.CTkLabel(
            row_frame,
            text=reg.status.value if reg.status else "PENDING",
            text_color=status_color,
            width=150
        )
        status_label.grid(row=0, column=3, padx=5, pady=5)
        
        # Payment status
        payment_colors = {
            "UNPAID": "red",
            "PERFORMANCE_PAID": "orange",
            "DIPLOMAS_PAID": "orange",
            "PAID": "green"
        }
        payment_color = payment_colors.get(reg.payment_status.value if reg.payment_status else "UNPAID", "gray")
        payment_label = ctk.CTkLabel(
            row_frame,
            text=reg.payment_status.value if reg.payment_status else "UNPAID",
            text_color=payment_color,
            width=150
        )
        payment_label.grid(row=0, column=4, padx=5, pady=5)
        
        row_frame.grid_columnconfigure(1, weight=1)
        row_frame.grid_columnconfigure(2, weight=1)


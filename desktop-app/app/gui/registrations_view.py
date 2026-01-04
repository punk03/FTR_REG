"""Registrations view component"""
import customtkinter as ctk
from typing import List, Dict, Any, Optional
from app.database.session import get_db_session
from app.database.models import Registration, Event
from app.utils.logger import logger
from app.utils.storage import load_display_settings, save_display_settings


class RegistrationsView(ctk.CTkFrame):
    """Registrations list view"""
    
    def __init__(self, parent, event_id: Optional[int] = None):
        super().__init__(parent)
        
        self.event_id = event_id
        self.display_settings = load_display_settings()
        
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
            text="📋 Регистрации",
            font=ctk.CTkFont(size=24, weight="bold")
        )
        title_label.grid(row=0, column=0, sticky="w", padx=10, pady=10)
        
        # Controls frame - use regular frame, not transparent
        controls_frame = ctk.CTkFrame(self)
        controls_frame.grid(row=1, column=0, sticky="ew", padx=10, pady=5)
        controls_frame.grid_columnconfigure(1, weight=1)
        
        # Event selector label
        event_label = ctk.CTkLabel(
            controls_frame,
            text="Событие:",
            font=ctk.CTkFont(size=14, weight="bold")
        )
        event_label.grid(row=0, column=0, padx=5, pady=5, sticky="w")
        
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
        
        # Settings button
        settings_btn = ctk.CTkButton(
            controls_frame,
            text="⚙️ Настройки",
            command=self._show_settings,
            width=120,
            height=35,
            font=ctk.CTkFont(size=12),
            corner_radius=8
        )
        settings_btn.grid(row=0, column=2, padx=5, pady=5, sticky="e")
        # Ensure button is clickable - use after to lift after rendering
        controls_frame.after(100, lambda: settings_btn.lift())
        
        # Refresh button
        refresh_btn = ctk.CTkButton(
            controls_frame,
            text="🔄 Обновить",
            command=self.refresh_registrations,
            width=120,
            height=35,
            font=ctk.CTkFont(size=12),
            corner_radius=8
        )
        refresh_btn.grid(row=0, column=3, padx=5, pady=5, sticky="e")
        # Ensure button is clickable - use after to lift after rendering
        controls_frame.after(100, lambda: refresh_btn.lift())
        
        # Registrations scrollable frame
        self.scrollable_frame = ctk.CTkScrollableFrame(self)
        self.scrollable_frame.grid(row=2, column=0, sticky="nsew", padx=10, pady=10)
        self.scrollable_frame.grid_columnconfigure(0, weight=1)
        
        # Status label
        self.status_label = ctk.CTkLabel(
            self,
            text="",
            font=ctk.CTkFont(size=12)
        )
        self.status_label.grid(row=3, column=0, pady=5)
        
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
    
    def _show_settings(self):
        """Show column display settings dialog"""
        dialog = ctk.CTkToplevel(self)
        dialog.title("Настройки отображения")
        dialog.geometry("400x500")
        dialog.transient(self)
        
        # Title
        title = ctk.CTkLabel(
            dialog,
            text="⚙️ Настройки отображения колонок",
            font=ctk.CTkFont(size=18, weight="bold")
        )
        title.pack(pady=15)
        
        # Checkboxes frame
        checkboxes_frame = ctk.CTkScrollableFrame(dialog)
        checkboxes_frame.pack(fill="both", expand=True, padx=20, pady=10)
        
        column_labels = {
            "number": "№",
            "collective": "Коллектив",
            "dance_name": "Название танца",
            "status": "Статус",
            "payment_status": "Оплата",
            "participants_count": "Количество участников",
            "notes": "Заметки",
        }
        
        checkboxes = {}
        for key, label in column_labels.items():
            var = ctk.BooleanVar(value=self.display_settings.get("registration_columns", {}).get(key, True))
            checkbox = ctk.CTkCheckBox(
                checkboxes_frame,
                text=label,
                variable=var,
                font=ctk.CTkFont(size=14)
            )
            checkbox.pack(pady=8, anchor="w")
            checkboxes[key] = var
        
        # Buttons
        buttons_frame = ctk.CTkFrame(dialog, fg_color="transparent")
        buttons_frame.pack(fill="x", padx=20, pady=15)
        
        def save_settings():
            self.display_settings["registration_columns"] = {
                key: var.get() for key, var in checkboxes.items()
            }
            save_display_settings(self.display_settings)
            self.refresh_registrations()
            dialog.destroy()
        
        save_btn = ctk.CTkButton(
            buttons_frame,
            text="💾 Сохранить",
            command=save_settings,
            width=150,
            height=35,
            font=ctk.CTkFont(size=14, weight="bold")
        )
        save_btn.pack(side="left", padx=5)
        
        cancel_btn = ctk.CTkButton(
            buttons_frame,
            text="Отмена",
            command=dialog.destroy,
            width=150,
            height=35,
            fg_color="gray",
            hover_color="darkgray",
            font=ctk.CTkFont(size=14)
        )
        cancel_btn.pack(side="right", padx=5)
    
    def refresh_registrations(self):
        """Refresh registrations list"""
        # Clear existing widgets
        for widget in self.scrollable_frame.winfo_children():
            widget.destroy()
        
        if not self.event_id:
            self.status_label.configure(text="", text_color="gray")
            no_event_label = ctk.CTkLabel(
                self.scrollable_frame,
                text="📭 Выберите событие для просмотра регистраций",
                font=ctk.CTkFont(size=16),
                justify="center"
            )
            no_event_label.pack(pady=40)
            return
        
        self.status_label.configure(text="⏳ Загрузка регистраций...", text_color="gray")
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
                
                registrations = db.query(Registration).filter(
                    Registration.event_id == event.id
                ).order_by(Registration.created_at.desc()).limit(500).all()  # Limit for performance
                
                self._render_registrations(registrations)
                self.status_label.configure(
                    text=f"✓ Загружено регистраций: {len(registrations)}",
                    text_color="green"
                )
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error loading registrations: {e}")
            error_label = ctk.CTkLabel(
                self.scrollable_frame,
                text=f"❌ Ошибка загрузки регистраций: {e}",
                text_color="red",
                font=ctk.CTkFont(size=14),
                wraplength=600
            )
            error_label.pack(pady=20)
            self.status_label.configure(
                text=f"✗ Ошибка: {str(e)[:50]}",
                text_color="red"
            )
    
    def _render_registrations(self, registrations: List[Registration]):
        """Render registrations table"""
        if not registrations:
            no_regs_label = ctk.CTkLabel(
                self.scrollable_frame,
                text="📭 Нет регистраций для этого события",
                font=ctk.CTkFont(size=16),
                justify="center"
            )
            no_regs_label.pack(pady=40)
            return
        
        # Get visible columns from settings
        columns = self.display_settings.get("registration_columns", {})
        
        # Create table headers
        headers_frame = ctk.CTkFrame(
            self.scrollable_frame,
            corner_radius=5,
            fg_color=("gray75", "gray25")
        )
        headers_frame.pack(fill="x", padx=5, pady=5)
        
        col = 0
        if columns.get("number", True):
            header = ctk.CTkLabel(
                headers_frame,
                text="№",
                font=ctk.CTkFont(size=12, weight="bold"),
                width=60
            )
            header.grid(row=0, column=col, padx=5, pady=10, sticky="ew")
            col += 1
        
        if columns.get("collective", True):
            header = ctk.CTkLabel(
                headers_frame,
                text="Коллектив",
                font=ctk.CTkFont(size=12, weight="bold"),
                width=200
            )
            header.grid(row=0, column=col, padx=5, pady=10, sticky="ew")
            headers_frame.grid_columnconfigure(col, weight=1)
            col += 1
        
        if columns.get("dance_name", True):
            header = ctk.CTkLabel(
                headers_frame,
                text="Название",
                font=ctk.CTkFont(size=12, weight="bold"),
                width=200
            )
            header.grid(row=0, column=col, padx=5, pady=10, sticky="ew")
            headers_frame.grid_columnconfigure(col, weight=1)
            col += 1
        
        if columns.get("status", True):
            header = ctk.CTkLabel(
                headers_frame,
                text="Статус",
                font=ctk.CTkFont(size=12, weight="bold"),
                width=120
            )
            header.grid(row=0, column=col, padx=5, pady=10, sticky="ew")
            col += 1
        
        if columns.get("payment_status", True):
            header = ctk.CTkLabel(
                headers_frame,
                text="Оплата",
                font=ctk.CTkFont(size=12, weight="bold"),
                width=120
            )
            header.grid(row=0, column=col, padx=5, pady=10, sticky="ew")
            col += 1
        
        if columns.get("participants_count", False):
            header = ctk.CTkLabel(
                headers_frame,
                text="Участники",
                font=ctk.CTkFont(size=12, weight="bold"),
                width=100
            )
            header.grid(row=0, column=col, padx=5, pady=10, sticky="ew")
            col += 1
        
        if columns.get("notes", False):
            header = ctk.CTkLabel(
                headers_frame,
                text="Заметки",
                font=ctk.CTkFont(size=12, weight="bold"),
                width=200
            )
            header.grid(row=0, column=col, padx=5, pady=10, sticky="ew")
            headers_frame.grid_columnconfigure(col, weight=1)
            col += 1
        
        # Create registration rows (limit for performance)
        for reg in registrations[:200]:  # Show max 200 rows for performance
            self._create_registration_row(reg, columns)
    
    def _create_registration_row(self, reg: Registration, columns: Dict[str, bool]):
        """Create registration table row"""
        row_frame = ctk.CTkFrame(
            self.scrollable_frame,
            corner_radius=3,
            border_width=1,
            border_color=("gray80", "gray20")
        )
        row_frame.pack(fill="x", padx=5, pady=2)
        row_frame.grid_columnconfigure(1, weight=1)
        row_frame.grid_columnconfigure(2, weight=1)
        if columns.get("notes", False):
            # Find notes column index
            notes_col = sum([
                columns.get("number", True),
                columns.get("collective", True),
                columns.get("dance_name", True),
                columns.get("status", True),
                columns.get("payment_status", True),
                columns.get("participants_count", False)
            ])
            row_frame.grid_columnconfigure(notes_col, weight=1)
        
        col = 0
        
        # Number
        if columns.get("number", True):
            number_label = ctk.CTkLabel(
                row_frame,
                text=str(reg.number or "-"),
                width=60,
                font=ctk.CTkFont(size=12)
            )
            number_label.grid(row=0, column=col, padx=5, pady=8, sticky="w")
            col += 1
        
        # Collective name
        if columns.get("collective", True):
            collective_name = "-"
            if reg.collective:
                collective_name = reg.collective.name
            collective_label = ctk.CTkLabel(
                row_frame,
                text=collective_name[:30] + "..." if len(collective_name) > 30 else collective_name,
                width=200,
                anchor="w",
                font=ctk.CTkFont(size=12)
            )
            collective_label.grid(row=0, column=col, padx=5, pady=8, sticky="ew")
            row_frame.grid_columnconfigure(col, weight=1)
            col += 1
        
        # Dance name
        if columns.get("dance_name", True):
            dance_label = ctk.CTkLabel(
                row_frame,
                text=(reg.dance_name or "-")[:30] + "..." if reg.dance_name and len(reg.dance_name) > 30 else (reg.dance_name or "-"),
                width=200,
                anchor="w",
                font=ctk.CTkFont(size=12)
            )
            dance_label.grid(row=0, column=col, padx=5, pady=8, sticky="ew")
            row_frame.grid_columnconfigure(col, weight=1)
            col += 1
        
        # Status
        if columns.get("status", True):
            status_colors = {
                "PENDING": ("yellow", "darkyellow"),
                "APPROVED": ("green", "darkgreen"),
                "REJECTED": ("red", "darkred")
            }
            status_color = status_colors.get(reg.status.value if reg.status else "PENDING", ("gray", "gray"))
            status_label = ctk.CTkLabel(
                row_frame,
                text=reg.status.value if reg.status else "PENDING",
                text_color="white",
                fg_color=status_color[1],
                width=120,
                corner_radius=10,
                font=ctk.CTkFont(size=11, weight="bold")
            )
            status_label.grid(row=0, column=col, padx=5, pady=8)
            col += 1
        
        # Payment status
        if columns.get("payment_status", True):
            payment_colors = {
                "UNPAID": ("red", "darkred"),
                "PERFORMANCE_PAID": ("orange", "darkorange"),
                "DIPLOMAS_PAID": ("orange", "darkorange"),
                "PAID": ("green", "darkgreen")
            }
            payment_color = payment_colors.get(reg.payment_status.value if reg.payment_status else "UNPAID", ("gray", "gray"))
            payment_label = ctk.CTkLabel(
                row_frame,
                text=reg.payment_status.value if reg.payment_status else "UNPAID",
                text_color="white",
                fg_color=payment_color[1],
                width=120,
                corner_radius=10,
                font=ctk.CTkFont(size=11, weight="bold")
            )
            payment_label.grid(row=0, column=col, padx=5, pady=8)
            col += 1
        
        # Participants count
        if columns.get("participants_count", False):
            participants_label = ctk.CTkLabel(
                row_frame,
                text=str(reg.participants_count or 0),
                width=100,
                font=ctk.CTkFont(size=12)
            )
            participants_label.grid(row=0, column=col, padx=5, pady=8)
            col += 1
        
        # Notes
        if columns.get("notes", False):
            notes_text = (reg.notes or "-")[:30] + "..." if reg.notes and len(reg.notes) > 30 else (reg.notes or "-")
            notes_label = ctk.CTkLabel(
                row_frame,
                text=notes_text,
                width=200,
                anchor="w",
                font=ctk.CTkFont(size=12)
            )
            notes_label.grid(row=0, column=col, padx=5, pady=8, sticky="ew")
            row_frame.grid_columnconfigure(col, weight=1)
            col += 1

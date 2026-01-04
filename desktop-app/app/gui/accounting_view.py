"""Accounting view for displaying and managing payments"""
import customtkinter as ctk
from typing import List, Optional, Dict, Any
from app.database.models import AccountingEntry, Event, PaymentMethod, PaidFor
from app.database.session import get_db_session
from app.utils.logger import logger
from datetime import datetime


class AccountingView(ctk.CTkFrame):
    """View for displaying accounting entries"""
    
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
            text="💰 Оплаты",
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
            command=self.refresh_accounting,
            width=120,
            height=35,
            font=ctk.CTkFont(size=12),
            corner_radius=8
        )
        refresh_btn.grid(row=0, column=2, padx=5, pady=5, sticky="e")
        controls_frame.after(100, lambda: refresh_btn.lift())
        
        # Accounting scrollable frame
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
            self.refresh_accounting()
    
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
            self.refresh_accounting()
        except Exception as e:
            logger.error(f"Error parsing event ID: {e}")
    
    def refresh_accounting(self):
        """Refresh accounting entries"""
        # Clear existing widgets
        for widget in self.scrollable_frame.winfo_children():
            widget.destroy()
        
        if not self.event_id:
            self.status_label.configure(text="", text_color="gray")
            no_event_label = ctk.CTkLabel(
                self.scrollable_frame,
                text="📭 Выберите событие для просмотра оплат",
                font=ctk.CTkFont(size=16),
                justify="center"
            )
            no_event_label.pack(pady=40)
            return
        
        self.status_label.configure(text="⏳ Загрузка оплат...", text_color="gray")
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
                
                # Get accounting entries
                entries = db.query(AccountingEntry).filter(
                    AccountingEntry.event_id == event.id,
                    AccountingEntry.deleted_at.is_(None)
                ).order_by(AccountingEntry.created_at.desc()).limit(200).all()
                
                self._render_accounting(entries)
                self.status_label.configure(
                    text=f"✓ Загружено оплат: {len(entries)}",
                    text_color="green"
                )
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error loading accounting: {e}")
            error_label = ctk.CTkLabel(
                self.scrollable_frame,
                text=f"❌ Ошибка загрузки оплат: {e}",
                text_color="red",
                font=ctk.CTkFont(size=14),
                wraplength=600
            )
            error_label.pack(pady=20)
            self.status_label.configure(
                text=f"✗ Ошибка: {str(e)[:50]}",
                text_color="red"
            )
    
    def _render_accounting(self, entries: List[AccountingEntry]):
        """Render accounting entries"""
        if not entries:
            no_entries_label = ctk.CTkLabel(
                self.scrollable_frame,
                text="📭 Нет оплат для этого события",
                font=ctk.CTkFont(size=16),
                justify="center"
            )
            no_entries_label.pack(pady=40)
            return
        
        # Summary frame
        summary_frame = ctk.CTkFrame(
            self.scrollable_frame,
            corner_radius=10,
            fg_color=("gray75", "gray25")
        )
        summary_frame.pack(fill="x", padx=5, pady=10)
        
        total_cash = sum(float(e.amount) for e in entries if e.method == PaymentMethod.CASH)
        total_card = sum(float(e.amount) for e in entries if e.method == PaymentMethod.CARD)
        total_transfer = sum(float(e.amount) for e in entries if e.method == PaymentMethod.TRANSFER)
        total_all = total_cash + total_card + total_transfer
        
        summary_label = ctk.CTkLabel(
            summary_frame,
            text=f"💰 Итого: Наличные: {total_cash:.2f} ₽ | Карта: {total_card:.2f} ₽ | Перевод: {total_transfer:.2f} ₽ | Всего: {total_all:.2f} ₽",
            font=ctk.CTkFont(size=14, weight="bold"),
            wraplength=800
        )
        summary_label.pack(pady=10, padx=10)
        
        # Create table headers
        headers_frame = ctk.CTkFrame(
            self.scrollable_frame,
            corner_radius=5,
            fg_color=("gray75", "gray25")
        )
        headers_frame.pack(fill="x", padx=5, pady=5)
        headers_frame.grid_columnconfigure(1, weight=1)
        headers_frame.grid_columnconfigure(2, weight=1)
        
        headers = ["Дата", "Сумма", "Метод", "Назначение", "Описание"]
        for col, header in enumerate(headers):
            header_label = ctk.CTkLabel(
                headers_frame,
                text=header,
                font=ctk.CTkFont(size=12, weight="bold"),
                width=120 if col == 0 else 150 if col < 3 else 200
            )
            header_label.grid(row=0, column=col, padx=5, pady=10, sticky="ew")
            if col >= 1:
                headers_frame.grid_columnconfigure(col, weight=1)
        
        # Create entries
        for entry in entries:
            self._create_accounting_row(entry)
    
    def _create_accounting_row(self, entry: AccountingEntry):
        """Create accounting entry row"""
        row_frame = ctk.CTkFrame(
            self.scrollable_frame,
            corner_radius=3,
            border_width=1,
            border_color=("gray80", "gray20")
        )
        row_frame.pack(fill="x", padx=5, pady=2)
        row_frame.grid_columnconfigure(1, weight=1)
        row_frame.grid_columnconfigure(2, weight=1)
        row_frame.grid_columnconfigure(4, weight=1)
        
        # Date
        date_str = entry.created_at.strftime("%d.%m.%Y %H:%M") if entry.created_at else "-"
        date_label = ctk.CTkLabel(
            row_frame,
            text=date_str,
            width=120,
            font=ctk.CTkFont(size=12)
        )
        date_label.grid(row=0, column=0, padx=5, pady=8, sticky="w")
        
        # Amount
        amount_label = ctk.CTkLabel(
            row_frame,
            text=f"{float(entry.amount):.2f} ₽",
            width=150,
            font=ctk.CTkFont(size=12, weight="bold")
        )
        amount_label.grid(row=0, column=1, padx=5, pady=8, sticky="w")
        
        # Method
        method_labels = {
            PaymentMethod.CASH: "Наличные",
            PaymentMethod.CARD: "Карта",
            PaymentMethod.TRANSFER: "Перевод"
        }
        method_label = ctk.CTkLabel(
            row_frame,
            text=method_labels.get(entry.method, entry.method.value),
            width=150,
            font=ctk.CTkFont(size=12)
        )
        method_label.grid(row=0, column=2, padx=5, pady=8, sticky="w")
        
        # Paid for
        paid_for_labels = {
            PaidFor.PERFORMANCE: "Рега",
            PaidFor.DIPLOMAS_MEDALS: "ДМ"
        }
        paid_for_label = ctk.CTkLabel(
            row_frame,
            text=paid_for_labels.get(entry.paid_for, entry.paid_for.value),
            width=200,
            font=ctk.CTkFont(size=12)
        )
        paid_for_label.grid(row=0, column=3, padx=5, pady=8, sticky="w")
        
        # Description
        desc_text = (entry.description or "-")[:50] + "..." if entry.description and len(entry.description) > 50 else (entry.description or "-")
        desc_label = ctk.CTkLabel(
            row_frame,
            text=desc_text,
            width=200,
            anchor="w",
            font=ctk.CTkFont(size=12)
        )
        desc_label.grid(row=0, column=4, padx=5, pady=8, sticky="ew")


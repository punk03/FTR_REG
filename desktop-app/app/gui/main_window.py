"""Main application window"""
import customtkinter as ctk
from typing import Optional
from app.services.auth_service import AuthService
from app.api.client import AuthenticationError, APIError
from app.utils.logger import logger
from app.gui.events_view import EventsView
from app.gui.registrations_view import RegistrationsView


class MainWindow(ctk.CTk):
    """Main application window"""
    
    def __init__(self, auth_service: AuthService):
        super().__init__()
        
        self.auth_service = auth_service
        
        # Configure window
        self.title("FTR Registration")
        self.geometry("1200x800")
        
        # Configure appearance
        ctk.set_appearance_mode("light")
        ctk.set_default_color_theme("blue")
        
        # Create UI
        self._create_ui()
        
        # Check authentication
        if not self.auth_service.is_authenticated():
            self._show_login()
        else:
            self._show_main_content()
    
    def _create_ui(self):
        """Create UI components"""
        # Main container
        self.main_container = ctk.CTkFrame(self)
        self.main_container.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Login frame (initially hidden)
        self.login_frame = None
        
        # Main content frame (initially hidden)
        self.content_frame = None
    
    def _show_login(self):
        """Show login screen"""
        if self.content_frame:
            self.content_frame.destroy()
        
        self.login_frame = ctk.CTkFrame(self.main_container)
        self.login_frame.pack(fill="both", expand=True)
        
        # Title
        title = ctk.CTkLabel(
            self.login_frame,
            text="FTR Registration",
            font=ctk.CTkFont(size=24, weight="bold")
        )
        title.pack(pady=20)
        
        # Email entry
        email_label = ctk.CTkLabel(self.login_frame, text="Email:")
        email_label.pack(pady=(10, 5))
        
        self.email_entry = ctk.CTkEntry(
            self.login_frame,
            width=300,
            placeholder_text="Введите email"
        )
        self.email_entry.pack(pady=5)
        
        # Password entry
        password_label = ctk.CTkLabel(self.login_frame, text="Пароль:")
        password_label.pack(pady=(10, 5))
        
        self.password_entry = ctk.CTkEntry(
            self.login_frame,
            width=300,
            show="*",
            placeholder_text="Введите пароль"
        )
        self.password_entry.pack(pady=5)
        
        # Login button
        login_button = ctk.CTkButton(
            self.login_frame,
            text="Войти",
            command=self._handle_login,
            width=300
        )
        login_button.pack(pady=20)
        
        # Status label (with word wrap)
        self.status_label = ctk.CTkLabel(
            self.login_frame,
            text="",
            text_color="red",
            wraplength=400,
            justify="left"
        )
        self.status_label.pack(pady=10, padx=20)
        
        # Offline mode button
        offline_button = ctk.CTkButton(
            self.login_frame,
            text="Работать оффлайн (без авторизации)",
            command=self._handle_offline_mode,
            width=300,
            fg_color="gray",
            hover_color="darkgray"
        )
        offline_button.pack(pady=10)
        
        # Bind Enter key
        self.password_entry.bind("<Return>", lambda e: self._handle_login())
    
    def _show_main_content(self):
        """Show main application content"""
        if self.login_frame:
            self.login_frame.destroy()
        
        self.content_frame = ctk.CTkFrame(self.main_container)
        self.content_frame.pack(fill="both", expand=True)
        
        # Top bar with user info, sync status and logout
        top_bar = ctk.CTkFrame(self.content_frame)
        top_bar.pack(fill="x", padx=10, pady=10)
        
        user = self.auth_service.get_user()
        if user:
            user_label = ctk.CTkLabel(
                top_bar,
                text=f"Пользователь: {user.get('name', 'Unknown')}",
                font=ctk.CTkFont(size=14)
            )
            user_label.pack(side="left", padx=10)
        
        # Sync button
        self.sync_button = ctk.CTkButton(
            top_bar,
            text="Синхронизировать",
            command=self._handle_sync,
            width=150
        )
        self.sync_button.pack(side="left", padx=10)
        
        # Sync status label
        self.sync_status_label = ctk.CTkLabel(
            top_bar,
            text="",
            font=ctk.CTkFont(size=12)
        )
        self.sync_status_label.pack(side="left", padx=10)
        
        logout_button = ctk.CTkButton(
            top_bar,
            text="Выйти",
            command=self._handle_logout,
            width=100
        )
        logout_button.pack(side="right", padx=10)
        
        # Auto-sync on startup
        self.after(1000, self._auto_sync_on_startup)
        
        # Tab view for different sections
        self.tabview = ctk.CTkTabview(self.content_frame)
        self.tabview.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Add tabs
        self.tabview.add("События")
        self.tabview.add("Регистрации")
        self.tabview.add("Оплаты")
        self.tabview.add("Статистика")
        
        # TODO: Add content to each tab
        self._setup_events_tab()
        self._setup_registrations_tab()
        self._setup_accounting_tab()
        self._setup_statistics_tab()
    
    def _setup_events_tab(self):
        """Setup events tab"""
        events_frame = self.tabview.tab("События")
        
        # Create events view
        self.events_view = EventsView(events_frame, on_event_select=self._on_event_selected)
        self.events_view.pack(fill="both", expand=True, padx=10, pady=10)
    
    def _setup_registrations_tab(self):
        """Setup registrations tab"""
        reg_frame = self.tabview.tab("Регистрации")
        
        # Create registrations view
        self.registrations_view = RegistrationsView(reg_frame)
        self.registrations_view.pack(fill="both", expand=True, padx=10, pady=10)
    
    def _on_event_selected(self, event_id: int):
        """Handle event selection"""
        logger.info(f"Event selected: {event_id}")
        # Switch to registrations tab and filter by event
        self.tabview.set("Регистрации")
        # Refresh registrations view with selected event
        if hasattr(self, 'registrations_view'):
            self.registrations_view.event_id = event_id
            self.registrations_view.refresh_registrations()
    
    def _handle_sync(self):
        """Handle manual sync"""
        self.sync_button.configure(state="disabled", text="Синхронизация...")
        self.sync_status_label.configure(text="Синхронизация...", text_color="blue")
        
        try:
            from app.database.session import get_db_session
            from app.api.sync import SyncService
            
            db = get_db_session()
            try:
                sync_service = SyncService(self.auth_service.api, db)
                result = sync_service.sync_all()
                
                if result.get("success"):
                    self.sync_status_label.configure(
                        text=f"✓ Синхронизировано: {result['synced']}",
                        text_color="green"
                    )
                    # Refresh views
                    if hasattr(self, 'events_view'):
                        self.events_view.refresh_events()
                    if hasattr(self, 'registrations_view'):
                        self.registrations_view._load_events()
                        self.registrations_view.refresh_registrations()
                else:
                    errors = result.get("errors", [])
                    self.sync_status_label.configure(
                        text=f"⚠ Ошибки: {len(errors)}",
                        text_color="orange"
                    )
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Sync error: {e}")
            self.sync_status_label.configure(
                text=f"✗ Ошибка: {str(e)[:50]}",
                text_color="red"
            )
        finally:
            self.sync_button.configure(state="normal", text="Синхронизировать")
            # Clear status after 5 seconds
            self.after(5000, lambda: self.sync_status_label.configure(text=""))
    
    def _auto_sync_on_startup(self):
        """Auto-sync on startup if enabled"""
        from app.utils.config import settings
        
        if settings.auto_sync and self.auth_service.is_authenticated():
            self._handle_sync()
    
    def _setup_accounting_tab(self):
        """Setup accounting tab"""
        acc_frame = self.tabview.tab("Оплаты")
        
        label = ctk.CTkLabel(
            acc_frame,
            text="Управление оплатами",
            font=ctk.CTkFont(size=16, weight="bold")
        )
        label.pack(pady=20)
        
        info_label = ctk.CTkLabel(
            acc_frame,
            text="Функциональность оплат будет добавлена в следующей версии",
            font=ctk.CTkFont(size=12)
        )
        info_label.pack(pady=10)
    
    def _setup_statistics_tab(self):
        """Setup statistics tab"""
        stats_frame = self.tabview.tab("Статистика")
        
        label = ctk.CTkLabel(
            stats_frame,
            text="Статистика",
            font=ctk.CTkFont(size=16, weight="bold")
        )
        label.pack(pady=20)
        
        info_label = ctk.CTkLabel(
            stats_frame,
            text="Функциональность статистики будет добавлена в следующей версии",
            font=ctk.CTkFont(size=12)
        )
        info_label.pack(pady=10)
    
    def _handle_login(self):
        """Handle login button click"""
        email = self.email_entry.get()
        password = self.password_entry.get()
        
        if not email or not password:
            self.status_label.configure(text="Введите email и пароль")
            return
        
        # Disable login button during request
        self.status_label.configure(text="Подключение к серверу...", text_color="blue")
        
        try:
            result = self.auth_service.login(email, password)
            if result.get("success"):
                self._show_main_content()
            else:
                self.status_label.configure(text="Ошибка входа", text_color="red")
        except (ConnectionError, APIError) as e:
            error_msg = str(e)
            if "resolve" in error_msg.lower() or "nodename" in error_msg.lower() or "cannot connect" in error_msg.lower():
                self.status_label.configure(
                    text="❌ Сервер недоступен. Проверьте:\n1. Адрес сервера в .env файле\n2. Интернет-соединение\n3. Доступность сервера",
                    text_color="red"
                )
            else:
                self.status_label.configure(
                    text=f"❌ Не удалось подключиться к серверу.\nПроверьте настройки в .env файле.",
                    text_color="red"
                )
            logger.error(f"Connection error: {e}")
        except AuthenticationError as e:
            self.status_label.configure(text="❌ Неверный email или пароль", text_color="red")
            logger.error(f"Authentication error: {e}")
        except Exception as e:
            logger.error(f"Login error: {e}")
            self.status_label.configure(
                text=f"❌ Ошибка: {str(e)[:100]}",
                text_color="red"
            )
    
    def _handle_logout(self):
        """Handle logout"""
        self.auth_service.logout()
        self._show_login()
    
    def _handle_offline_mode(self):
        """Handle offline mode - work without authentication"""
        # Check if we have any data in local DB
        from app.database.session import get_db_session
        from app.database.models import Event
        
        db = get_db_session()
        try:
            events_count = db.query(Event).count()
            if events_count > 0:
                # We have data, allow offline mode
                self.auth_service.enable_offline_mode()
                self._show_main_content()
            else:
                self.status_label.configure(
                    text="⚠️ Оффлайн режим недоступен:\nНет данных в локальной БД.\nСначала нужно синхронизироваться с сервером.\n\nПроверьте:\n1. Правильность адреса сервера в .env\n2. Доступность сервера",
                    text_color="orange"
                )
        except Exception as e:
            logger.error(f"Error checking offline mode: {e}")
            self.status_label.configure(
                text="⚠️ Ошибка проверки оффлайн режима",
                text_color="red"
            )
        finally:
            db.close()


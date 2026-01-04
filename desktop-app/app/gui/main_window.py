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
        
        # Configure appearance - force dark theme
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("dark-blue")
        
        # Create UI
        self._create_ui()
        
        # Try to load saved authentication
        if self.auth_service.load_saved_auth():
            # Validate token
            if self.auth_service.is_token_valid():
                self._show_main_content()
                return
        
        # Show login if no saved auth or token invalid
        self._show_login()
    
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
        
        self.login_frame = ctk.CTkFrame(self.main_container, fg_color="transparent")
        self.login_frame.pack(fill="both", expand=True)
        
        # Centered container - use pack with expand
        center_frame = ctk.CTkFrame(self.login_frame, fg_color="transparent")
        center_frame.pack(expand=True, fill="both")
        
        # Title with icon
        title_container = ctk.CTkFrame(center_frame, fg_color="transparent")
        title_container.pack(pady=20)
        
        title_icon = ctk.CTkLabel(
            title_container,
            text="🎭",
            font=ctk.CTkFont(size=48)
        )
        title_icon.pack(pady=10)
        
        title = ctk.CTkLabel(
            title_container,
            text="FTR Registration",
            font=ctk.CTkFont(size=32, weight="bold")
        )
        title.pack(pady=5)
        
        subtitle = ctk.CTkLabel(
            title_container,
            text="Система управления регистрациями",
            font=ctk.CTkFont(size=14),
            text_color=("gray60", "gray40")
        )
        subtitle.pack(pady=5)
        
        # Form frame
        form_frame = ctk.CTkFrame(center_frame, corner_radius=15)
        form_frame.pack(pady=30, padx=40)
        
        # Email entry
        email_label = ctk.CTkLabel(
            form_frame,
            text="📧 Email:",
            font=ctk.CTkFont(size=14, weight="bold")
        )
        email_label.pack(pady=(20, 5), padx=30)
        
        self.email_entry = ctk.CTkEntry(
            form_frame,
            width=350,
            height=40,
            placeholder_text="Введите email",
            font=ctk.CTkFont(size=14),
            corner_radius=8
        )
        self.email_entry.pack(pady=5, padx=30)
        
        # Password entry
        password_label = ctk.CTkLabel(
            form_frame,
            text="🔒 Пароль:",
            font=ctk.CTkFont(size=14, weight="bold")
        )
        password_label.pack(pady=(15, 5), padx=30)
        
        self.password_entry = ctk.CTkEntry(
            form_frame,
            width=350,
            height=40,
            placeholder_text="Введите пароль",
            show="*",
            font=ctk.CTkFont(size=14),
            corner_radius=8
        )
        self.password_entry.pack(pady=5, padx=30)
        
        # Login button
        self.login_button = ctk.CTkButton(
            form_frame,
            text="🚀 Войти",
            command=self._handle_login,
            width=350,
            height=45,
            font=ctk.CTkFont(size=16, weight="bold"),
            corner_radius=8
        )
        self.login_button.pack(pady=(20, 10), padx=30)
        # Ensure button is clickable - use after to lift after rendering
        form_frame.after(100, lambda: self.login_button.lift())
        
        # Status label
        self.status_label = ctk.CTkLabel(
            form_frame,
            text="",
            font=ctk.CTkFont(size=12),
            wraplength=350
        )
        self.status_label.pack(pady=10, padx=30)
        
        # Offline mode button
        offline_button = ctk.CTkButton(
            form_frame,
            text="📴 Работать оффлайн (без авторизации)",
            command=self._handle_offline_mode,
            width=350,
            height=35,
            fg_color="gray",
            hover_color="darkgray",
            font=ctk.CTkFont(size=12),
            corner_radius=8
        )
        offline_button.pack(pady=10, padx=30)
        # Ensure button is clickable - use after to lift after rendering
        form_frame.after(100, lambda: offline_button.lift())
        
        # Bind Enter key
        self.password_entry.bind("<Return>", lambda e: self._handle_login())
    
    def _show_main_content(self):
        """Show main application content"""
        if self.login_frame:
            self.login_frame.destroy()
        
        self.content_frame = ctk.CTkFrame(self.main_container)
        self.content_frame.pack(fill="both", expand=True)
        
        # Top bar with user info, sync status and logout
        top_bar = ctk.CTkFrame(
            self.content_frame,
            corner_radius=0,
            fg_color=("gray85", "gray17")
        )
        top_bar.pack(fill="x", padx=0, pady=0)
        top_bar.grid_columnconfigure(1, weight=1)  # User label column
        top_bar.grid_columnconfigure(3, weight=0)  # Status label column
        
        # User info - directly in top_bar to avoid frame overlap
        user = self.auth_service.get_user()
        if user:
            user_icon = ctk.CTkLabel(
                top_bar,
                text="👤",
                font=ctk.CTkFont(size=16)
            )
            user_icon.grid(row=0, column=0, sticky="w", padx=(15, 5), pady=10)
            
            user_label = ctk.CTkLabel(
                top_bar,
                text=f"{user.get('name', 'Unknown')} ({user.get('role', 'USER')})",
                font=ctk.CTkFont(size=14, weight="bold")
            )
            user_label.grid(row=0, column=1, sticky="w", padx=5, pady=10)
        
        # Sync button - directly in top_bar
        self.sync_button = ctk.CTkButton(
            top_bar,
            text="🔄 Синхронизировать",
            command=self._handle_sync,
            width=180,
            height=35,
            font=ctk.CTkFont(size=13, weight="bold"),
            corner_radius=8
        )
        self.sync_button.grid(row=0, column=2, sticky="", padx=10, pady=10)
        # Ensure button is clickable - use after to lift after rendering
        top_bar.after(100, lambda: self.sync_button.lift())
        
        # Sync status label
        self.sync_status_label = ctk.CTkLabel(
            top_bar,
            text="",
            font=ctk.CTkFont(size=12)
        )
        self.sync_status_label.grid(row=0, column=3, sticky="w", padx=10, pady=10)
        
        # Logout button - directly in top_bar
        logout_button = ctk.CTkButton(
            top_bar,
            text="🚪 Выйти",
            command=self._handle_logout,
            width=120,
            height=35,
            fg_color=("gray65", "gray45"),
            hover_color=("gray55", "gray35"),
            font=ctk.CTkFont(size=13, weight="bold"),
            corner_radius=8
        )
        logout_button.grid(row=0, column=4, sticky="e", padx=15, pady=10)
        # Ensure button is clickable - use after to lift after rendering
        top_bar.after(100, lambda: logout_button.lift())
        
        # Update grid column weights
        top_bar.grid_columnconfigure(1, weight=1)
        
        # Auto-sync on startup
        self.after(1000, self._auto_sync_on_startup)
        
        # Tab view for different sections
        self.tabview = ctk.CTkTabview(
            self.content_frame,
            corner_radius=10,
            border_width=2,
            border_color=("gray70", "gray30")
        )
        self.tabview.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Ensure tabview is on top
        self.tabview.lift()
        
        # Add tabs with icons
        self.tabview.add("📅 События")
        self.tabview.add("📋 Регистрации")
        self.tabview.add("💰 Оплаты")
        self.tabview.add("📊 Статистика")
        
        # Setup tabs
        self._setup_events_tab()
        self._setup_registrations_tab()
        self._setup_accounting_tab()
        self._setup_statistics_tab()
    
    def _setup_events_tab(self):
        """Setup events tab"""
        events_frame = self.tabview.tab("📅 События")
        
        # Create events view
        self.events_view = EventsView(events_frame, on_event_select=self._on_event_selected)
        self.events_view.pack(fill="both", expand=True, padx=10, pady=10)
    
    def _setup_registrations_tab(self):
        """Setup registrations tab"""
        reg_frame = self.tabview.tab("📋 Регистрации")
        
        # Create registrations view
        self.registrations_view = RegistrationsView(reg_frame)
        self.registrations_view.pack(fill="both", expand=True, padx=10, pady=10)
    
    def _on_event_selected(self, event_id: int):
        """Handle event selection"""
        logger.info(f"Event selected: {event_id}")
        # Switch to registrations tab and filter by event
        self.tabview.set("📋 Регистрации")
        # Refresh registrations view with selected event
        if hasattr(self, 'registrations_view'):
            self.registrations_view.event_id = event_id
            self.registrations_view.refresh_registrations()
    
    def _handle_sync(self):
        """Handle manual sync"""
        self.sync_button.configure(state="disabled", text="Синхронизация...")
        self.sync_status_label.configure(text="Синхронизация с сервером...", text_color="blue")
        
        def do_sync():
            try:
                from app.database.session import get_db_session
                from app.api.sync import SyncService
                
                db = get_db_session()
                try:
                    sync_service = SyncService(self.auth_service.api, db)
                    result = sync_service.sync_all()
                    
                    if result.get("success"):
                        synced = result.get("synced", {})
                        events_count = synced.get("events", 0)
                        regs_count = synced.get("registrations", 0)
                        
                        status_text = f"✓ Синхронизировано: событий {events_count}, регистраций {regs_count}"
                        self.sync_status_label.configure(
                            text=status_text,
                            text_color="green"
                        )
                        
                        # Refresh views
                        self.after(100, lambda: self._refresh_all_views())
                    else:
                        errors = result.get("errors", [])
                        error_msg = errors[0] if errors else "Неизвестная ошибка"
                        self.sync_status_label.configure(
                            text=f"⚠ Ошибка: {error_msg[:60]}",
                            text_color="orange"
                        )
                finally:
                    db.close()
            except Exception as e:
                logger.error(f"Sync error: {e}", exc_info=True)
                error_msg = str(e)
                if "Cannot connect" in error_msg or "resolve" in error_msg.lower():
                    self.sync_status_label.configure(
                        text="✗ Сервер недоступен. Проверьте подключение.",
                        text_color="red"
                    )
                else:
                    self.sync_status_label.configure(
                        text=f"✗ Ошибка: {error_msg[:50]}",
                        text_color="red"
                    )
            finally:
                self.sync_button.configure(state="normal", text="Синхронизировать")
                # Clear status after 10 seconds
                self.after(10000, lambda: self.sync_status_label.configure(text=""))
        
        # Run sync in a thread to avoid blocking UI
        import threading
        thread = threading.Thread(target=do_sync, daemon=True)
        thread.start()
    
    def _refresh_all_views(self):
        """Refresh all views"""
        if hasattr(self, 'events_view'):
            self.events_view.refresh_events()
        if hasattr(self, 'registrations_view'):
            self.registrations_view._load_events()
            self.registrations_view.refresh_registrations()
    
    def _auto_sync_on_startup(self):
        """Auto-sync on startup if enabled"""
        from app.utils.config import settings
        from app.database.session import get_db_session
        from app.database.models import Event
        
        # Check if we have any data
        db = get_db_session()
        try:
            events_count = db.query(Event).count()
            if events_count == 0 and settings.auto_sync and self.auth_service.is_authenticated():
                # No data, try to sync
                logger.info("No local data found, starting auto-sync...")
                self._handle_sync()
            elif events_count > 0:
                # We have data, refresh views
                logger.info(f"Found {events_count} events in local DB")
                if hasattr(self, 'events_view'):
                    self.events_view.refresh_events()
        except Exception as e:
            logger.error(f"Error checking local data: {e}")
        finally:
            db.close()
    
    def _setup_accounting_tab(self):
        """Setup accounting tab"""
        acc_frame = self.tabview.tab("💰 Оплаты")
        
        # Centered content
        content_frame = ctk.CTkFrame(acc_frame, fg_color="transparent")
        content_frame.place(relx=0.5, rely=0.5, anchor="center")
        
        icon_label = ctk.CTkLabel(
            content_frame,
            text="💰",
            font=ctk.CTkFont(size=64)
        )
        icon_label.pack(pady=20)
        
        label = ctk.CTkLabel(
            content_frame,
            text="Управление оплатами",
            font=ctk.CTkFont(size=24, weight="bold")
        )
        label.pack(pady=10)
        
        info_label = ctk.CTkLabel(
            content_frame,
            text="Функциональность оплат будет добавлена в следующей версии",
            font=ctk.CTkFont(size=14),
            text_color=("gray60", "gray40"),
            wraplength=400,
            justify="center"
        )
        info_label.pack(pady=10)
    
    def _setup_statistics_tab(self):
        """Setup statistics tab"""
        stats_frame = self.tabview.tab("📊 Статистика")
        
        # Centered content
        content_frame = ctk.CTkFrame(stats_frame, fg_color="transparent")
        content_frame.place(relx=0.5, rely=0.5, anchor="center")
        
        icon_label = ctk.CTkLabel(
            content_frame,
            text="📊",
            font=ctk.CTkFont(size=64)
        )
        icon_label.pack(pady=20)
        
        label = ctk.CTkLabel(
            content_frame,
            text="Статистика",
            font=ctk.CTkFont(size=24, weight="bold")
        )
        label.pack(pady=10)
        
        info_label = ctk.CTkLabel(
            content_frame,
            text="Функциональность статистики будет добавлена в следующей версии",
            font=ctk.CTkFont(size=14),
            text_color=("gray60", "gray40"),
            wraplength=400,
            justify="center"
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
        except APIError as e:
            # Handle rate limiting (429)
            if hasattr(e, 'status_code') and e.status_code == 429:
                retry_after = getattr(e, 'retry_after', 60)
                self.status_label.configure(
                    text=f"⏱ Слишком много попыток входа.\nПодождите {retry_after} секунд перед следующей попыткой.",
                    text_color="orange"
                )
                # Disable login button temporarily
                self.login_button.configure(state="disabled")
                self.after(retry_after * 1000, lambda: (
                    self.login_button.configure(state="normal"),
                    self.status_label.configure(text="")
                ))
            else:
                error_msg = str(e)
                if "resolve" in error_msg.lower() or "nodename" in error_msg.lower() or "cannot connect" in error_msg.lower():
                    self.status_label.configure(
                        text="❌ Сервер недоступен. Проверьте:\n1. Адрес сервера в .env файле\n2. Интернет-соединение\n3. Доступность сервера",
                        text_color="red"
                    )
                else:
                    self.status_label.configure(
                        text=f"Ошибка подключения: {error_msg}",
                        text_color="red"
                    )
        except ConnectionError as e:
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


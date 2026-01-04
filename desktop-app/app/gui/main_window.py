"""Main application window"""
import customtkinter as ctk
from typing import Optional
from app.services.auth_service import AuthService
from app.api.client import AuthenticationError, APIError
from app.utils.logger import logger


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
        
        # Top bar with user info and logout
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
        
        logout_button = ctk.CTkButton(
            top_bar,
            text="Выйти",
            command=self._handle_logout,
            width=100
        )
        logout_button.pack(side="right", padx=10)
        
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
        
        label = ctk.CTkLabel(events_frame, text="Управление событиями")
        label.pack(pady=20)
        
        # TODO: Add events list and management
    
    def _setup_registrations_tab(self):
        """Setup registrations tab"""
        reg_frame = self.tabview.tab("Регистрации")
        
        label = ctk.CTkLabel(reg_frame, text="Управление регистрациями")
        label.pack(pady=20)
        
        # TODO: Add registrations list and management
    
    def _setup_accounting_tab(self):
        """Setup accounting tab"""
        acc_frame = self.tabview.tab("Оплаты")
        
        label = ctk.CTkLabel(acc_frame, text="Управление оплатами")
        label.pack(pady=20)
        
        # TODO: Add accounting entries list
    
    def _setup_statistics_tab(self):
        """Setup statistics tab"""
        stats_frame = self.tabview.tab("Статистика")
        
        label = ctk.CTkLabel(stats_frame, text="Статистика")
        label.pack(pady=20)
        
        # TODO: Add statistics display
    
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


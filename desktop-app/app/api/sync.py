"""Synchronization service"""
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.database.models import (
    Event, Registration, AccountingEntry, Collective,
    Discipline, Nomination, Age, Category, Person,
    RegistrationLeader, RegistrationTrainer,
    SyncStatus
)
from app.api.client import APIClient, APIError, AuthenticationError
from app.utils.logger import logger


class SyncService:
    """Service for synchronizing local database with server"""
    
    def __init__(self, api_client: APIClient, db_session: Session):
        self.api = api_client
        self.db = db_session
    
    def sync_all(self) -> Dict[str, Any]:
        """Sync all data with server"""
        result = {
            "success": True,
            "synced": {
                "events": 0,
                "registrations": 0,
                "accounting_entries": 0,
                "reference_data": 0,
                "collectives": 0,
            },
            "errors": [],
        }
        
        try:
            # Sync reference data first (needed for other data)
            self.sync_reference_data()
            result["synced"]["reference_data"] = 1
            
            # Sync events
            events_count = self.sync_events()
            result["synced"]["events"] = events_count
            
            # Sync registrations for each event
            events = self.db.query(Event).filter(Event.server_id.isnot(None)).all()
            for event in events:
                try:
                    regs_count = self.sync_registrations(event.server_id)
                    result["synced"]["registrations"] += regs_count
                except Exception as e:
                    logger.error(f"Error syncing registrations for event {event.server_id}: {e}")
                    result["errors"].append(f"Event {event.server_id} registrations: {e}")
            
            # Sync accounting entries
            acc_count = self.sync_accounting_entries()
            result["synced"]["accounting_entries"] = acc_count
            
            # Push local changes to server
            self.push_local_changes()
            
        except Exception as e:
            logger.error(f"Error during sync: {e}")
            result["success"] = False
            result["errors"].append(str(e))
        
        return result
    
    def sync_reference_data(self):
        """Sync reference data (disciplines, nominations, ages, categories)"""
        try:
            # Sync disciplines
            disciplines = self.api.get("/api/reference/disciplines") or []
            for disc_data in disciplines:
                disc = self.db.query(Discipline).filter(
                    Discipline.server_id == disc_data["id"]
                ).first()
                
                if not disc:
                    disc = Discipline(server_id=disc_data["id"])
                    self.db.add(disc)
                
                disc.name = disc_data["name"]
                # Update other fields if needed
            
            # Sync nominations
            nominations = self.api.get("/api/reference/nominations") or []
            for nom_data in nominations:
                nom = self.db.query(Nomination).filter(
                    Nomination.server_id == nom_data["id"]
                ).first()
                
                if not nom:
                    nom = Nomination(server_id=nom_data["id"])
                    self.db.add(nom)
                
                nom.name = nom_data["name"]
            
            # Sync ages
            ages = self.api.get("/api/reference/ages") or []
            for age_data in ages:
                age = self.db.query(Age).filter(
                    Age.server_id == age_data["id"]
                ).first()
                
                if not age:
                    age = Age(server_id=age_data["id"])
                    self.db.add(age)
                
                age.name = age_data["name"]
            
            # Sync categories
            categories = self.api.get("/api/reference/categories") or []
            for cat_data in categories:
                cat = self.db.query(Category).filter(
                    Category.server_id == cat_data["id"]
                ).first()
                
                if not cat:
                    cat = Category(server_id=cat_data["id"])
                    self.db.add(cat)
                
                cat.name = cat_data["name"]
            
            self.db.commit()
            logger.info("Reference data synced")
        
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error syncing reference data: {e}")
            raise
    
    def sync_events(self) -> int:
        """Sync events from server"""
        try:
            # Use /api/reference/events endpoint (same as frontend)
            response = self.api.get("/api/reference/events")
            events_data = response if isinstance(response, list) else (response.get("events", []) if response else [])
            count = 0
            
            for event_data in events_data:
                event = self.db.query(Event).filter(
                    Event.server_id == event_data["id"]
                ).first()
                
                if not event:
                    event = Event(server_id=event_data["id"])
                    self.db.add(event)
                
                # Update event data
                event.name = event_data["name"]
                event.start_date = datetime.fromisoformat(event_data["startDate"].replace("Z", "+00:00"))
                event.end_date = datetime.fromisoformat(event_data["endDate"].replace("Z", "+00:00"))
                event.description = event_data.get("description")
                event.status = event_data.get("status", "DRAFT")
                event.is_online = event_data.get("isOnline", False)
                event.payment_enable = event_data.get("paymentEnable", True)
                event.category_enable = event_data.get("categoryEnable", True)
                event.calculator_token = event_data.get("calculatorToken")
                event.sync_status = SyncStatus.SYNCED
                event.last_synced_at = datetime.utcnow()
                
                count += 1
            
            self.db.commit()
            logger.info(f"Synced {count} events")
            return count
        
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error syncing events: {e}")
            raise
    
    def sync_registrations(self, event_id: int) -> int:
        """Sync registrations for an event"""
        try:
            page = 1
            limit = 100
            total_count = 0
            
            while True:
                registrations_data = self.api.get(
                    "/api/registrations",
                    params={"eventId": event_id, "page": page, "limit": limit}
                ) or {}
                
                registrations = registrations_data.get("registrations", [])
                if not registrations:
                    break
                
                for reg_data in registrations:
                    # Skip if required fields are missing
                    if not reg_data.get("eventId") or not reg_data.get("disciplineId") or not reg_data.get("nominationId") or not reg_data.get("ageId"):
                        logger.warning(f"Skipping registration {reg_data.get('id')}: missing required fields")
                        continue
                    
                    # Sync collective if needed
                    if reg_data.get("collectiveId"):
                        collective_data = reg_data.get("collective")
                        self._ensure_collective_exists(reg_data.get("collectiveId"), collective_data)
                    
                    reg = self.db.query(Registration).filter(
                        Registration.server_id == reg_data["id"]
                    ).first()
                    
                    if not reg:
                        reg = Registration(server_id=reg_data["id"])
                        self.db.add(reg)
                    
                    # Update registration data
                    try:
                        self._update_registration_from_data(reg, reg_data)
                        reg.sync_status = SyncStatus.SYNCED
                        reg.last_synced_at = datetime.utcnow()
                        total_count += 1
                    except Exception as e:
                        logger.error(f"Error updating registration {reg_data.get('id')}: {e}")
                        # Continue with next registration
                        continue
                
                # Check if there are more pages
                pagination = registrations_data.get("pagination", {})
                if page >= pagination.get("totalPages", 1):
                    break
                
                page += 1
            
            self.db.commit()
            logger.info(f"Synced {total_count} registrations for event {event_id}")
            return total_count
        
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error syncing registrations: {e}")
            raise
    
    def _update_registration_from_data(self, reg: Registration, data: Dict[str, Any]):
        """Update registration from API data"""
        # Map API data to model
        # Note: user_id is not synced as we don't have User model in local DB
        # collective_id can be None if collective not synced yet
        reg.event_id = self._get_local_id(Event, data.get("eventId"))
        collective_id = self._get_local_id(Collective, data.get("collectiveId"))
        reg.collective_id = collective_id  # Can be None
        reg.discipline_id = self._get_local_id(Discipline, data.get("disciplineId"))
        reg.nomination_id = self._get_local_id(Nomination, data.get("nominationId"))
        reg.age_id = self._get_local_id(Age, data.get("ageId"))
        if data.get("categoryId"):
            reg.category_id = self._get_local_id(Category, data.get("categoryId"))
        
        reg.dance_name = data.get("danceName")
        reg.duration = data.get("duration")
        reg.participants_count = data.get("participantsCount", 0)
        reg.federation_participants_count = data.get("federationParticipantsCount", 0)
        reg.diplomas_count = data.get("diplomasCount", 0)
        reg.medals_count = data.get("medalsCount", 0)
        reg.diplomas_list = data.get("diplomasList")
        reg.payment_status = data.get("paymentStatus", "UNPAID")
        reg.paid_amount = data.get("paidAmount")
        reg.performance_paid = data.get("performancePaid", False)
        reg.diplomas_and_medals_paid = data.get("diplomasAndMedalsPaid", False)
        reg.diplomas_printed = data.get("diplomasPrinted", False)
        reg.status = data.get("status", "PENDING")
        reg.notes = data.get("notes")
        reg.number = data.get("number")
        reg.block_number = data.get("blockNumber")
        reg.video_url = data.get("videoUrl")
        reg.song_url = data.get("songUrl")
        reg.agreement = data.get("agreement", False)
        reg.agreement2 = data.get("agreement2", False)
        
        # Update leaders and trainers
        # (This is simplified - you may need to handle this more carefully)
    
    def _ensure_collective_exists(self, collective_id: int, collective_data: Optional[Dict[str, Any]] = None):
        """Ensure collective exists in local DB"""
        collective = self.db.query(Collective).filter(
            Collective.server_id == collective_id
        ).first()
        
        if not collective:
            collective = Collective(server_id=collective_id)
            if collective_data:
                collective.name = collective_data.get("name", f"Collective {collective_id}")
            else:
                collective.name = f"Collective {collective_id}"
            self.db.add(collective)
            self.db.commit()
            logger.info(f"Created collective {collective_id}: {collective.name}")
    
    def _get_local_id(self, model_class, server_id: Optional[int]) -> Optional[int]:
        """Get local ID from server ID"""
        if not server_id:
            return None
        
        obj = self.db.query(model_class).filter(
            model_class.server_id == server_id
        ).first()
        
        if not obj:
            # Log warning but don't fail - some references might not be synced yet
            logger.warning(f"Reference not found: {model_class.__name__} with server_id={server_id}")
            return None
        
        return obj.id
    
    def sync_accounting_entries(self) -> int:
        """Sync accounting entries"""
        # Similar to sync_registrations
        # Implementation depends on your API structure
        return 0
    
    def push_local_changes(self):
        """Push local changes to server"""
        # Find all items with sync_status = PENDING
        # Push them to server
        # Update sync_status to SYNCED
        pass


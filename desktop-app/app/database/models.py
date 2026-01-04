"""Database models for local SQLite database"""
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, 
    Numeric, ForeignKey, Text, Enum as SQLEnum
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import enum

Base = declarative_base()


class PaymentStatus(enum.Enum):
    UNPAID = "UNPAID"
    PERFORMANCE_PAID = "PERFORMANCE_PAID"
    DIPLOMAS_PAID = "DIPLOMAS_PAID"
    PAID = "PAID"


class RegistrationStatus(enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class PaymentMethod(enum.Enum):
    CASH = "CASH"
    CARD = "CARD"
    TRANSFER = "TRANSFER"


class PaidFor(enum.Enum):
    PERFORMANCE = "PERFORMANCE"
    DIPLOMAS_MEDALS = "DIPLOMAS_MEDALS"


class EventStatus(enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class SyncStatus(enum.Enum):
    SYNCED = "SYNCED"
    PENDING = "PENDING"
    CONFLICT = "CONFLICT"
    ERROR = "ERROR"


class Event(Base):
    """Event model"""
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True)
    server_id = Column(Integer, unique=True, nullable=True, index=True)  # ID на сервере
    name = Column(String, nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(SQLEnum(EventStatus), default=EventStatus.DRAFT)
    is_online = Column(Boolean, default=False)
    payment_enable = Column(Boolean, default=True)
    category_enable = Column(Boolean, default=True)
    calculator_token = Column(String, nullable=True, unique=True)
    
    # Sync metadata
    sync_status = Column(SQLEnum(SyncStatus), default=SyncStatus.SYNCED)
    last_synced_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    registrations = relationship("Registration", back_populates="event", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.server_id or self.id,
            "name": self.name,
            "startDate": self.start_date.isoformat() if self.start_date else None,
            "endDate": self.end_date.isoformat() if self.end_date else None,
            "description": self.description,
            "status": self.status.value if self.status else None,
            "isOnline": self.is_online,
            "paymentEnable": self.payment_enable,
            "categoryEnable": self.category_enable,
            "calculatorToken": self.calculator_token,
        }


class Collective(Base):
    """Collective model"""
    __tablename__ = "collectives"
    
    id = Column(Integer, primary_key=True)
    server_id = Column(Integer, unique=True, nullable=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    accessory = Column(String, nullable=True)
    school = Column(String, nullable=True)
    contacts = Column(String, nullable=True)
    city = Column(String, nullable=True)
    
    # Sync metadata
    sync_status = Column(SQLEnum(SyncStatus), default=SyncStatus.SYNCED)
    last_synced_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    registrations = relationship("Registration", back_populates="collective")


class Discipline(Base):
    """Discipline model"""
    __tablename__ = "disciplines"
    
    id = Column(Integer, primary_key=True)
    server_id = Column(Integer, unique=True, nullable=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    abbreviations = Column(Text, nullable=True)  # JSON
    variants = Column(Text, nullable=True)  # JSON
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    registrations = relationship("Registration", back_populates="discipline")


class Nomination(Base):
    """Nomination model"""
    __tablename__ = "nominations"
    
    id = Column(Integer, primary_key=True)
    server_id = Column(Integer, unique=True, nullable=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    registrations = relationship("Registration", back_populates="nomination")


class Age(Base):
    """Age model"""
    __tablename__ = "ages"
    
    id = Column(Integer, primary_key=True)
    server_id = Column(Integer, unique=True, nullable=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    registrations = relationship("Registration", back_populates="age")


class Category(Base):
    """Category model"""
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True)
    server_id = Column(Integer, unique=True, nullable=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    registrations = relationship("Registration", back_populates="category")


class Person(Base):
    """Person model (leaders/trainers)"""
    __tablename__ = "persons"
    
    id = Column(Integer, primary_key=True)
    server_id = Column(Integer, unique=True, nullable=True, index=True)
    full_name = Column(String, nullable=False, index=True)
    role = Column(String, nullable=False)  # LEADER or TRAINER
    phone = Column(String, nullable=True)
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class Registration(Base):
    """Registration model"""
    __tablename__ = "registrations"
    
    id = Column(Integer, primary_key=True)
    server_id = Column(Integer, unique=True, nullable=True, index=True)
    
    # Foreign keys
    user_id = Column(Integer, nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False, index=True)
    collective_id = Column(Integer, ForeignKey("collectives.id"), nullable=False, index=True)
    discipline_id = Column(Integer, ForeignKey("disciplines.id"), nullable=False)
    nomination_id = Column(Integer, ForeignKey("nominations.id"), nullable=False)
    age_id = Column(Integer, ForeignKey("ages.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    
    # Registration data
    dance_name = Column(String, nullable=True, index=True)
    duration = Column(String, nullable=True)
    participants_count = Column(Integer, default=0)
    federation_participants_count = Column(Integer, default=0)
    diplomas_count = Column(Integer, default=0)
    medals_count = Column(Integer, default=0)
    diplomas_list = Column(Text, nullable=True)
    payment_status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.UNPAID, index=True)
    paid_amount = Column(Numeric(10, 2), nullable=True)
    performance_paid = Column(Boolean, default=False)
    diplomas_and_medals_paid = Column(Boolean, default=False)
    diplomas_printed = Column(Boolean, default=False)
    status = Column(SQLEnum(RegistrationStatus), default=RegistrationStatus.PENDING, index=True)
    notes = Column(Text, nullable=True)
    number = Column(Integer, nullable=True)
    block_number = Column(Integer, nullable=True)
    video_url = Column(String, nullable=True)
    song_url = Column(String, nullable=True)
    agreement = Column(Boolean, default=False)
    agreement2 = Column(Boolean, default=False)
    
    # Sync metadata
    sync_status = Column(SQLEnum(SyncStatus), default=SyncStatus.SYNCED)
    last_synced_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    event = relationship("Event", back_populates="registrations")
    collective = relationship("Collective", back_populates="registrations")
    discipline = relationship("Discipline", back_populates="registrations")
    nomination = relationship("Nomination", back_populates="registrations")
    age = relationship("Age", back_populates="registrations")
    category = relationship("Category", back_populates="registrations")
    leaders = relationship("RegistrationLeader", back_populates="registration", cascade="all, delete-orphan")
    trainers = relationship("RegistrationTrainer", back_populates="registration", cascade="all, delete-orphan")
    accounting_entries = relationship("AccountingEntry", back_populates="registration", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.server_id or self.id,
            "eventId": self.event_id,
            "collectiveId": self.collective_id,
            "disciplineId": self.discipline_id,
            "nominationId": self.nomination_id,
            "ageId": self.age_id,
            "categoryId": self.category_id,
            "danceName": self.dance_name,
            "duration": self.duration,
            "participantsCount": self.participants_count,
            "federationParticipantsCount": self.federation_participants_count,
            "diplomasCount": self.diplomas_count,
            "medalsCount": self.medals_count,
            "diplomasList": self.diplomas_list,
            "paymentStatus": self.payment_status.value if self.payment_status else None,
            "paidAmount": float(self.paid_amount) if self.paid_amount else None,
            "performancePaid": self.performance_paid,
            "diplomasAndMedalsPaid": self.diplomas_and_medals_paid,
            "diplomasPrinted": self.diplomas_printed,
            "status": self.status.value if self.status else None,
            "notes": self.notes,
            "number": self.number,
            "blockNumber": self.block_number,
            "videoUrl": self.video_url,
            "songUrl": self.song_url,
            "agreement": self.agreement,
            "agreement2": self.agreement2,
        }


class RegistrationLeader(Base):
    """Registration-Leader relationship"""
    __tablename__ = "registration_leaders"
    
    id = Column(Integer, primary_key=True)
    registration_id = Column(Integer, ForeignKey("registrations.id"), nullable=False, index=True)
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    registration = relationship("Registration", back_populates="leaders")
    person = relationship("Person")


class RegistrationTrainer(Base):
    """Registration-Trainer relationship"""
    __tablename__ = "registration_trainers"
    
    id = Column(Integer, primary_key=True)
    registration_id = Column(Integer, ForeignKey("registrations.id"), nullable=False, index=True)
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    registration = relationship("Registration", back_populates="trainers")
    person = relationship("Person")


class AccountingEntry(Base):
    """Accounting entry model"""
    __tablename__ = "accounting_entries"
    
    id = Column(Integer, primary_key=True)
    server_id = Column(Integer, unique=True, nullable=True, index=True)
    
    registration_id = Column(Integer, ForeignKey("registrations.id"), nullable=True, index=True)
    collective_id = Column(Integer, ForeignKey("collectives.id"), nullable=True)
    event_id = Column(Integer, nullable=True, index=True)
    
    amount = Column(Numeric(10, 2), nullable=False)
    discount_amount = Column(Numeric(10, 2), default=0)
    discount_percent = Column(Numeric(5, 2), default=0)
    method = Column(SQLEnum(PaymentMethod), nullable=False)
    paid_for = Column(SQLEnum(PaidFor), nullable=False, index=True)
    payment_group_id = Column(String, nullable=True, index=True)
    payment_group_name = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    deleted_at = Column(DateTime, nullable=True, index=True)
    
    # Sync metadata
    sync_status = Column(SQLEnum(SyncStatus), default=SyncStatus.SYNCED)
    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    registration = relationship("Registration", back_populates="accounting_entries")
    collective = relationship("Collective")
    
    def to_dict(self):
        return {
            "id": self.server_id or self.id,
            "registrationId": self.registration_id,
            "collectiveId": self.collective_id,
            "eventId": self.event_id,
            "amount": float(self.amount) if self.amount else 0,
            "discountAmount": float(self.discount_amount) if self.discount_amount else 0,
            "discountPercent": float(self.discount_percent) if self.discount_percent else 0,
            "method": self.method.value if self.method else None,
            "paidFor": self.paid_for.value if self.paid_for else None,
            "paymentGroupId": self.payment_group_id,
            "paymentGroupName": self.payment_group_name,
            "description": self.description,
            "deletedAt": self.deleted_at.isoformat() if self.deleted_at else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


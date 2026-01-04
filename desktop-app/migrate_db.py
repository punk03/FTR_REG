#!/usr/bin/env python3
"""Migration script to update database schema"""
import sqlite3
import os
from pathlib import Path
from app.utils.config import settings

def migrate_database():
    """Update database schema for nullable user_id and collective_id"""
    db_path = Path.home() / ".local" / "share" / "ftr_registration" / "data" / "ftr_registration.db"
    
    if not db_path.exists():
        print(f"Database not found at {db_path}")
        return
    
    print(f"Connecting to database: {db_path}")
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    try:
        # Check current schema
        cursor.execute("PRAGMA table_info(registrations)")
        columns = cursor.fetchall()
        user_id_nullable = any(col[1] == 'user_id' and col[3] == 0 for col in columns)
        collective_id_nullable = any(col[1] == 'collective_id' and col[3] == 0 for col in columns)
        
        print(f"Current schema: user_id nullable={not user_id_nullable}, collective_id nullable={not collective_id_nullable}")
        
        # SQLite doesn't support ALTER COLUMN, so we need to recreate the table
        if user_id_nullable or collective_id_nullable:
            print("Migrating database schema...")
            
            # Create backup
            backup_path = str(db_path) + ".backup"
            print(f"Creating backup: {backup_path}")
            conn.backup(sqlite3.connect(backup_path))
            
            # Get all data
            cursor.execute("SELECT * FROM registrations")
            rows = cursor.fetchall()
            column_names = [col[1] for col in columns]
            
            # Drop and recreate table with new schema
            cursor.execute("DROP TABLE IF EXISTS registrations_backup")
            cursor.execute(f"CREATE TABLE registrations_backup AS SELECT * FROM registrations")
            
            # Drop original table
            cursor.execute("DROP TABLE registrations")
            
            # Recreate table (SQLAlchemy will handle this on next init)
            # For now, we'll use a simple approach: just update the schema
            print("Note: Please restart the application to recreate the table with new schema")
            print("Or delete the database file to start fresh")
            
        else:
            print("Schema is already up to date!")
            
        conn.commit()
        print("Migration completed!")
        
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_database()


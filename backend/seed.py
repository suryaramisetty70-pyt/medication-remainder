import sqlite3

DB_PATH = "database.db"

def seed():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Clear existing data so we start fresh
    cursor.execute("DELETE FROM adherence_logs")
    cursor.execute("DELETE FROM medications")
    cursor.execute("DELETE FROM users")
    cursor.execute("DELETE FROM sqlite_sequence WHERE name='medications'")
    cursor.execute("DELETE FROM sqlite_sequence WHERE name='adherence_logs'")
    cursor.execute("DELETE FROM sqlite_sequence WHERE name='users'")
    
    # 1. Insert Parent & Child Users
    cursor.execute("INSERT INTO users (username, role) VALUES ('Parent User', 'parent')")
    parent_id = cursor.lastrowid
    
    cursor.execute("INSERT INTO users (username, role, parent_id) VALUES ('Child User', 'child', ?)", (parent_id,))
    
    conn.commit()
    conn.close()
    print("Database cleared. Seeded clean Parent and Child user accounts successfully!")

if __name__ == "__main__":
    seed()

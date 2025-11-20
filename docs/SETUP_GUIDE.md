# Database Setup Guide (Windows)

Since we are running the backend locally, you need to have **PostgreSQL** installed and running.

## 1. Install PostgreSQL
1.  **Download**: Go to [postgresql.org/download/windows/](https://www.postgresql.org/download/windows/) and download the interactive installer by EDB.
2.  **Install**: Run the installer.
    -   Use the default port **5432**.
    -   **Important**: You will be asked to set a password for the database superuser (`postgres`). **Remember this password!** (e.g., `password` or `admin`).

## 2. Create the Database
You can use **pgAdmin** (installed with Postgres) or the command line.

### Option A: Using pgAdmin (GUI)
1.  Open **pgAdmin 4**.
2.  Expand **Servers** > **PostgreSQL 16** (or your version).
3.  Right-click **Databases** > **Create** > **Database...**
4.  Name it: `assignwell`
5.  Click **Save**.

### Option B: Using Command Line (SQL Shell)
1.  Open **SQL Shell (psql)** from your Start menu.
2.  Press Enter to accept defaults (Server, Database, Port, Username).
3.  Enter your password when prompted.
4.  Run this command:
    ```sql
    CREATE DATABASE assignwell;
    ```
5.  Type `\q` to exit.

## 3. Update Backend Configuration
I need to know your database credentials to connect the backend.

By default, I have configured it as:
-   **User**: `postgres`
-   **Password**: `password`
-   **Host**: `localhost`
-   **Port**: `5432`
-   **Database**: `assignwell`

**If your password is different**, please let me know, or I can show you how to update the `.env` file.

## 4. Verify Connection
Once the database is created and running, let me know, and I will run the migrations to set up the tables.

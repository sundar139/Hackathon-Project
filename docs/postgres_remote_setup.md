# How to Connect to PostgreSQL on Another Machine

Since your database is on a **different computer** (let's call it the **Server**) than the one running the code (the **Client**), you need to configure the Server to accept connections from the Client.

Follow these steps on the **Server** (the machine with the database):

## 1. Find the Server's IP Address
- Open a terminal (Command Prompt or PowerShell) on the **Server**.
- Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux).
- Look for the **IPv4 Address** (e.g., `192.168.1.15` or `172.22.2.63`).
- **Action**: Update your `backend/.env` file on the **Client** machine with this IP:
  ```env
  POSTGRES_SERVER=192.168.1.15  <-- Replace with the actual IP
  ```

## 2. Configure PostgreSQL to Listen on All Addresses
By default, Postgres only listens to `localhost`. You need to change this.

- Locate the `postgresql.conf` file.
  - On Windows (default): `C:\Program Files\PostgreSQL\15\data\postgresql.conf` (version number may vary).
  - You can find the path by running this query in pgAdmin: `SHOW config_file;`
- Open `postgresql.conf` in a text editor (Run as Administrator).
- Find the line: `#listen_addresses = 'localhost'`
- Change it to:
  ```conf
  listen_addresses = '*'
  ```
  (Make sure to remove the `#` at the start).

## 3. Allow the Client to Connect (pg_hba.conf)
You need to tell Postgres that the Client's IP is allowed to log in.

- Locate the `pg_hba.conf` file (usually in the same folder as `postgresql.conf`).
- Open it in a text editor (Run as Administrator).
- Scroll to the bottom and add this line:
  ```conf
  host    all             all             0.0.0.0/0            scram-sha-256
  ```
  - **Note**: `0.0.0.0/0` allows **any** IP to connect. For better security, use the specific IP of your Client machine (e.g., `192.168.1.10/32`).
  - If your password encryption is older, you might need `md5` instead of `scram-sha-256`.

## 4. Allow Port 5432 in the Firewall
Windows Firewall might be blocking the connection.

- Open **Windows Defender Firewall with Advanced Security** on the **Server**.
- Click **Inbound Rules** -> **New Rule...**
- Select **Port** -> **Next**.
- Select **TCP** and enter **5432** in "Specific local ports" -> **Next**.
- Select **Allow the connection** -> **Next**.
- Check Domain, Private, Public (or just Private/Domain if on home network) -> **Next**.
- Name it "PostgreSQL" -> **Finish**.

## 5. Restart PostgreSQL Service
- Open **Services** (Win+R, type `services.msc`).
- Find **postgresql-x64-15** (or your version).
- Right-click -> **Restart**.

## 6. Test the Connection
- Go back to your **Client** machine.
- Try running the backend again.

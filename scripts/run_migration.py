#!/usr/bin/env python3
"""
Run SQL migration against Supabase database.

Usage:
  python scripts/run_migration.py --db-url "postgresql://..."

Or set environment variable:
  export DATABASE_URL="postgresql://postgres.jvgeyxoiekgvfwiixvql:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
  python scripts/run_migration.py

Get your database password from:
  Supabase Dashboard > Project Settings > Database > Connection string
"""

import argparse
import os
import sys

def main():
    parser = argparse.ArgumentParser(description="Run Supabase migration")
    parser.add_argument(
        "--db-url",
        help="PostgreSQL connection string",
        default=os.environ.get("DATABASE_URL")
    )
    parser.add_argument(
        "--migration",
        help="Path to migration SQL file",
        default="supabase/migrations/009_multi_account_support.sql"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print SQL without executing"
    )

    args = parser.parse_args()

    # Read migration file
    if not os.path.exists(args.migration):
        print(f"Error: Migration file not found: {args.migration}")
        sys.exit(1)

    with open(args.migration, "r") as f:
        sql = f.read()

    if args.dry_run:
        print("=== DRY RUN - SQL to execute ===")
        print(sql)
        return

    if not args.db_url:
        print("Error: Database URL required")
        print("\nProvide via --db-url or DATABASE_URL environment variable")
        print("\nGet your connection string from:")
        print("  Supabase Dashboard > Project Settings > Database > Connection string")
        print("\nExample:")
        print('  postgresql://postgres.jvgeyxoiekgvfwiixvql:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres')
        sys.exit(1)

    try:
        import psycopg2
    except ImportError:
        print("Installing psycopg2-binary...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary", "-q"])
        import psycopg2

    print(f"Connecting to database...")
    try:
        conn = psycopg2.connect(args.db_url)
        conn.autocommit = True
        cur = conn.cursor()

        print(f"Executing migration: {args.migration}")
        cur.execute(sql)

        print("Migration completed successfully!")

        # Verify the table was created
        cur.execute("SELECT COUNT(*) FROM user_mt_accounts")
        count = cur.fetchone()[0]
        print(f"Table 'user_mt_accounts' now has {count} rows")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

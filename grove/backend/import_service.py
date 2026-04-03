import csv
import logging
import os
from datetime import datetime
from typing import Dict, Any, List, Optional

from google.cloud import firestore
from google.oauth2 import service_account

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def initialize_firestore_client(service_account_path: str) -> Optional[firestore.Client]:
    """
    Initializes a Firestore client using a service account key file.
    
    Args:
        service_account_path: Path to the service account JSON key file.
        
    Returns:
        An initialized google.cloud.firestore.Client object, or None if an error occurs.
    """
    try:
        if not os.path.exists(service_account_path):
            logger.error(f"Service account key file not found at: {service_account_path}")
            return None
            
        credentials = service_account.Credentials.from_service_account_file(service_account_path)
        client = firestore.Client(credentials=credentials)
        return client
    except Exception as e:
        logger.error(f"Failed to initialize Firestore client: {str(e)}")
        return None

def import_contacts_from_csv(csv_file_path: str, firestore_ref: firestore.Client) -> Dict[str, Any]:
    """
    Imports contact data from a CSV file into Google Firestore.
    
    Args:
        csv_file_path: Path to the CSV file.
        firestore_ref: An instance of google.cloud.firestore.Client.
        
    Returns:
        A dictionary summarizing the import results.
    """
    summary = {
        'total_processed': 0,
        'successful_imports': 0,
        'failed_imports': 0,
        'errors': []
    }

    try:
        with open(csv_file_path, mode='r', encoding='utf-8-sig') as csv_file:
            # Using DictReader to handle headers automatically
            reader = csv.DictReader(csv_file)
            
            for row_idx, row in enumerate(reader, start=1):
                summary['total_processed'] += 1
                try:
                    # Extract Contact Id for the document ID
                    contact_id = row.get("Contact Id")
                    if not contact_id:
                        raise ValueError(f"Row {row_idx}: Missing 'Contact Id'")

                    # Parse Tags into a list of trimmed strings
                    tags_str = row.get("Tags", "")
                    tags = [tag.strip() for tag in tags_str.split(',')] if tags_str else []

                    # Helper to parse dates
                    def parse_date(date_str: str):
                        if not date_str:
                            return None
                        try:
                            # Try common formats or let Firestore handle it if it's a string
                            # For demonstration, we'll try to convert to datetime
                            # but preserve string if it fails as per requirements
                            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                        except (ValueError, TypeError):
                            return date_str

                    # Map fields strictly as requested
                    contact_data = {
                        "first_name": row.get("First Name", ""),
                        "last_name": row.get("Last Name", ""),
                        "phone": row.get("Phone", ""),
                        "email": row.get("Email", ""),
                        "company_name": row.get("Business Name", ""),
                        "created_at": parse_date(row.get("Created", "")),
                        "last_activity": parse_date(row.get("Last Activity", "")),
                        "tags": tags
                    }

                    # Create/Update document in 'contacts' collection using Contact Id
                    # Using .document(id).set(data) as strictly required
                    firestore_ref.collection('contacts').document(str(contact_id)).set(contact_data)
                    
                    summary['successful_imports'] += 1
                    logger.info(f"Successfully imported contact {contact_id}")

                except Exception as e:
                    summary['failed_imports'] += 1
                    error_msg = f"Error processing row {row_idx} (Contact Id: {row.get('Contact Id', 'N/A')}): {str(e)}"
                    summary['errors'].append(error_msg)
                    logger.error(error_msg)

    except FileNotFoundError:
        error_msg = f"File not found: {csv_file_path}"
        summary['errors'].append(error_msg)
        logger.error(error_msg)
    except Exception as e:
        error_msg = f"Unexpected error reading CSV: {str(e)}"
        summary['errors'].append(error_msg)
        logger.error(error_msg)

    return summary

if __name__ == "__main__":
    # Path to service account key
    KEY_PATH = "grove/backend/serviceAccountKey.json"
    
    # Path to CSV file
    CSV_PATH = "dummy_contacts.csv"
    
    # 1. Programmatically create a dummy CSV file for demonstration
    logger.info(f"Creating dummy CSV file: {CSV_PATH}")
    csv_headers = ["Contact Id", "First Name", "Last Name", "Phone", "Email", "Business Name", "Created", "Last Activity", "Tags"]
    csv_rows = [
        # Standard row with tags
        ["CID-001", "John", "Doe", "555-0101", "john@example.com", "Doe Corp", "2023-01-15T10:00:00Z", "2023-10-01T14:30:00Z", "prospect, tech"],
        # Row with missing data (First Name/Last Name empty)
        ["CID-002", "", "", "555-0102", "jane@example.com", "Jane's Shop", "2023-02-20T09:00:00Z", "", "retail"],
        # Row with date parsing challenges (non-ISO format)
        ["CID-003", "Bob", "Smith", "555-0103", "bob@example.com", "Smith & Co", "Oct 12, 2023", "2023-11-05", "vip"],
        # Row with missing Contact Id (should fail)
        ["", "Error", "Row", "", "error@example.com", "", "", "", ""]
    ]
    
    with open(CSV_PATH, mode='w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(csv_headers)
        writer.writerows(csv_rows)

    # 2. Initialize Firestore client
    db = initialize_firestore_client(KEY_PATH)
    
    if db:
        # 3. Import contacts
        results = import_contacts_from_csv(CSV_PATH, db)
        
        print("\nImport Summary:")
        print(f"Total Processed: {results['total_processed']}")
        print(f"Successful: {results['successful_imports']}")
        print(f"Failed: {results['failed_imports']}")
        if results['errors']:
            print("\nErrors:")
            for err in results['errors']:
                print(f"- {err}")
    else:
        print(f"\nCould not initialize Firestore client. Please ensure '{KEY_PATH}' exists and is valid.")

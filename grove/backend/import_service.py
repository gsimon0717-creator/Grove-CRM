import csv
import logging
from datetime import datetime
from typing import Dict, Any, List

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def import_contacts_from_csv(csv_file_path: str, firestore_ref) -> Dict[str, Any]:
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
    # Example usage (for demonstration)
    import os
    from google.cloud import firestore
    from google.oauth2 import service_account

    # Path to service account key
    KEY_PATH = "grove/backend/serviceAccountKey.json"
    
    if os.path.exists(KEY_PATH):
        credentials = service_account.Credentials.from_service_account_file(KEY_PATH)
        db = firestore.Client(credentials=credentials)
        
        # Path to CSV file
        CSV_PATH = "contacts_to_import.csv"
        
        if os.path.exists(CSV_PATH):
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
            print(f"CSV file not found at {CSV_PATH}")
    else:
        print(f"Service account key not found at {KEY_PATH}")

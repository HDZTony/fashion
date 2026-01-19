"""
Google Search Console API Service
Provides integration with Google Search Console API for SEO management
Uses google-api-python-client for all API interactions
"""
import os
import json
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


class SearchConsoleService:
    """Service for interacting with Google Search Console API"""
    
    # OAuth 2.0 scopes required for Search Console API
    SCOPES = [
        'https://www.googleapis.com/auth/webmasters',
        'https://www.googleapis.com/auth/webmasters.readonly',
    ]
    
    def __init__(self):
        self.client_id = os.getenv('GOOGLE_CLIENT_ID')
        self.client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        self.redirect_uri = os.getenv('GOOGLE_REDIRECT_URI', 'https://fashion-rec.com/callback')
        
    def get_oauth_flow(self) -> Flow:
        """Create OAuth 2.0 flow for Google authentication"""
        if not self.client_id or not self.client_secret:
            raise ValueError("Google OAuth credentials not configured")
        
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [self.redirect_uri],
                }
            },
            scopes=self.SCOPES,
        )
        flow.redirect_uri = self.redirect_uri
        return flow
    
    def get_authorization_url(self) -> str:
        """Get authorization URL for OAuth flow"""
        flow = self.get_oauth_flow()
        authorization_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        return authorization_url
    
    def get_credentials_from_code(self, code: str) -> Credentials:
        """Exchange authorization code for credentials"""
        flow = self.get_oauth_flow()
        flow.fetch_token(code=code)
        return flow.credentials
    
    def get_service(self, credentials_dict: Dict[str, Any], update_callback: Optional[callable] = None) -> Any:
        """
        Build Search Console service from credentials
        Automatically refreshes token if expired
        
        Args:
            credentials_dict: OAuth credentials dictionary (may be updated if token is refreshed)
            update_callback: Optional callback function to save updated credentials
                           Signature: update_callback(user_id: str, updated_credentials: Dict[str, Any])
        
        Returns:
            Google API service instance
        """
        credentials = Credentials.from_authorized_user_info(credentials_dict)
        
        # Refresh token if expired
        token_refreshed = False
        if credentials.expired and credentials.refresh_token:
            try:
                credentials.refresh(Request())
                token_refreshed = True
                
                # Update credentials_dict with new token
                credentials_dict.update({
                    'token': credentials.token,
                    'expiry': credentials.expiry.isoformat() if credentials.expiry else None,
                })
                
                print(f"[SearchConsole] Token refreshed successfully")
            except Exception as e:
                print(f"[SearchConsole] Failed to refresh token: {e}")
                raise Exception(f"Token expired and refresh failed: {str(e)}")
        
        # Build service with cache_discovery=False for faster initialization
        service = build('searchconsole', 'v1', credentials=credentials, cache_discovery=False)
        
        # If token was refreshed and callback provided, save updated credentials
        if token_refreshed and update_callback and 'user_id' in credentials_dict:
            try:
                update_callback(credentials_dict.get('user_id'), credentials_dict)
            except Exception as e:
                print(f"[SearchConsole] Warning: Failed to save refreshed token: {e}")
        
        return service
    
    def verify_site(
        self, 
        credentials_dict: Dict[str, Any], 
        site_url: str,
        update_callback: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Verify site ownership using Site Verification API
        Uses google-api-python-client to interact with Site Verification API
        """
        try:
            credentials = Credentials.from_authorized_user_info(credentials_dict)
            
            # Refresh token if expired
            token_refreshed = False
            if credentials.expired and credentials.refresh_token:
                credentials.refresh(Request())
                token_refreshed = True
                credentials_dict.update({
                    'token': credentials.token,
                    'expiry': credentials.expiry.isoformat() if credentials.expiry else None,
                })
            
            # Build Site Verification service
            service = build('siteverification', 'v1', credentials=credentials, cache_discovery=False)
            
            # Save refreshed token if callback provided
            if token_refreshed and update_callback and 'user_id' in credentials_dict:
                try:
                    update_callback(credentials_dict.get('user_id'), credentials_dict)
                except Exception as e:
                    print(f"[SearchConsole] Warning: Failed to save refreshed token: {e}")
            
            # Try to get existing verification
            try:
                resource = service.webResource().get(id=site_url).execute()
                return {
                    'verified': True,
                    'message': 'Site is already verified',
                    'verification_method': resource.get('owners', [])
                }
            except HttpError as e:
                if e.resp.status == 404:
                    # Site not verified, need to verify
                    return {
                        'verified': False,
                        'message': 'Site not verified. Please verify through Google Search Console.'
                    }
                # Re-raise other HTTP errors
                error_details = json.loads(e.content.decode('utf-8'))
                return {
                    'verified': False,
                    'message': f'Verification check failed: {error_details.get("error", {}).get("message", str(e))}'
                }
        except Exception as e:
            return {
                'verified': False,
                'message': f'Verification failed: {str(e)}'
            }
    
    def submit_sitemap(
        self, 
        credentials_dict: Dict[str, Any], 
        site_url: str, 
        sitemap_url: str,
        update_callback: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Submit sitemap to Google Search Console
        Uses google-api-python-client sitemaps().submit() method
        """
        try:
            service = self.get_service(credentials_dict, update_callback)
            
            # Submit sitemap using google-api-python-client
            request = service.sitemaps().submit(
                siteUrl=site_url,
                feedpath=sitemap_url
            )
            result = request.execute()
            
            return {
                'success': True,
                'message': f'Sitemap {sitemap_url} submitted successfully',
                'result': result
            }
        except HttpError as e:
            # Parse error response
            try:
                error_details = json.loads(e.content.decode('utf-8'))
                error_message = error_details.get('error', {}).get('message', str(e))
            except:
                error_message = str(e)
            
            return {
                'success': False,
                'message': f'Failed to submit sitemap: {error_message}',
                'error_code': e.resp.status if hasattr(e, 'resp') else None
            }
        except Exception as e:
            return {
                'success': False,
                'message': f'Error submitting sitemap: {str(e)}'
            }
    
    def inspect_url(
        self, 
        credentials_dict: Dict[str, Any], 
        url: str,
        update_callback: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Inspect URL using URL Inspection API
        Uses google-api-python-client urlInspection().index().inspect() method
        """
        try:
            service = self.get_service(credentials_dict)
            
            # Use URL Inspection API
            request = service.urlInspection().index().inspect(
                body={'inspectionUrl': url}
            )
            response = request.execute()
            
            inspection_result = response.get('inspectionResult', {})
            index_status = inspection_result.get('indexStatusResult', {})
            
            # Extract detailed information
            verdict = index_status.get('verdict', 'UNKNOWN')
            page_fetch_state = index_status.get('pageFetchState', '')
            http_status_code = index_status.get('httpStatusCode')
            
            errors = []
            if page_fetch_state == 'HTTP_ERROR' and http_status_code:
                errors.append(f"HTTP Error {http_status_code}")
            elif page_fetch_state:
                errors.append(f"Fetch State: {page_fetch_state}")
            
            return {
                'indexingStatus': verdict,
                'lastCrawlTime': index_status.get('lastCrawlTime'),
                'coverageState': index_status.get('coverageState'),
                'pageFetchState': page_fetch_state,
                'httpStatusCode': http_status_code,
                'errors': errors,
                'indexingState': index_status.get('indexingState'),
                'userCanRequestIndexing': index_status.get('userCanRequestIndexing', False)
            }
        except HttpError as e:
            try:
                error_details = json.loads(e.content.decode('utf-8'))
                error_message = error_details.get('error', {}).get('message', str(e))
            except:
                error_message = str(e)
            
            return {
                'indexingStatus': 'ERROR',
                'errors': [error_message],
                'error_code': e.resp.status if hasattr(e, 'resp') else None
            }
        except Exception as e:
            return {
                'indexingStatus': 'ERROR',
                'errors': [f'Inspection failed: {str(e)}']
            }
    
    def get_search_analytics(
        self,
        credentials_dict: Dict[str, Any],
        site_url: str,
        start_date: str,
        end_date: str,
        dimensions: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Get search analytics data from Search Console
        Uses google-api-python-client searchanalytics().query() method
        
        Args:
            credentials_dict: OAuth credentials dictionary
            site_url: Site URL (e.g., 'https://fashion-rec.com')
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            dimensions: Optional list of dimensions (e.g., ['query', 'page', 'device'])
        
        Returns:
            Dictionary with clicks, impressions, CTR, and top queries
        """
        try:
            service = self.get_service(credentials_dict)
            
            dimensions = dimensions or ['query']
            
            # Build request using google-api-python-client
            request = service.searchanalytics().query(
                siteUrl=site_url,
                body={
                    'startDate': start_date,
                    'endDate': end_date,
                    'dimensions': dimensions,
                    'rowLimit': 25  # Increased limit for better data
                }
            )
            response = request.execute()
            
            rows = response.get('rows', [])
            
            # Calculate totals
            total_clicks = sum(row.get('clicks', 0) for row in rows)
            total_impressions = sum(row.get('impressions', 0) for row in rows)
            total_ctr = total_clicks / total_impressions if total_impressions > 0 else 0
            total_position = sum(row.get('position', 0) for row in rows) / len(rows) if rows else 0
            
            # Get top queries with detailed information
            top_queries = [
                {
                    'query': row.get('keys', [''])[0] if dimensions == ['query'] else row.get('keys', ['']),
                    'clicks': row.get('clicks', 0),
                    'impressions': row.get('impressions', 0),
                    'ctr': row.get('ctr', 0),
                    'position': row.get('position', 0)
                }
                for row in rows[:10]
            ]
            
            return {
                'clicks': total_clicks,
                'impressions': total_impressions,
                'ctr': total_ctr,
                'averagePosition': total_position,
                'topQueries': top_queries,
                'rowCount': len(rows)
            }
        except HttpError as e:
            try:
                error_details = json.loads(e.content.decode('utf-8'))
                error_message = error_details.get('error', {}).get('message', str(e))
            except:
                error_message = str(e)
            raise Exception(f"Failed to get analytics: {error_message}")
        except Exception as e:
            raise Exception(f"Error getting analytics: {str(e)}")
    
    def check_connection(
        self, 
        credentials_dict: Optional[Dict[str, Any]], 
        update_callback: Optional[callable] = None
    ) -> bool:
        """
        Check if Search Console is connected and credentials are valid
        Uses google-api-python-client sites().list() to verify connection
        
        Args:
            credentials_dict: OAuth credentials dictionary
            update_callback: Optional callback to save refreshed token
                           Signature: update_callback(user_id: str, updated_credentials: Dict[str, Any])
        
        Returns:
            True if connected and credentials are valid, False otherwise
        """
        if not credentials_dict:
            return False
        
        try:
            service = self.get_service(credentials_dict, update_callback)
            # Try to list sites to verify connection
            # This is a lightweight API call that verifies authentication
            request = service.sites().list()
            request.execute()
            return True
        except HttpError as e:
            # If we get a 401, credentials are invalid
            if hasattr(e, 'resp') and e.resp.status == 401:
                return False
            # Other errors might be temporary, but connection exists
            return True
        except Exception as e:
            print(f"[SearchConsole] Connection check failed: {e}")
            return False

    def get_video_search_analytics(
        self,
        credentials_dict: Dict[str, Any],
        site_url: str,
        start_date: str,
        end_date: str
    ) -> Dict[str, Any]:
        """
        Get video search analytics data from Search Console
        Specifically looks for video search results and performance

        Args:
            credentials_dict: OAuth credentials dictionary
            site_url: Site URL (e.g., 'https://fashion-rec.com')
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format

        Returns:
            Dictionary with video search performance data
        """
        try:
            service = self.get_service(credentials_dict)

            # Query for video search results specifically
            request = service.searchanalytics().query(
                siteUrl=site_url,
                body={
                    'startDate': start_date,
                    'endDate': end_date,
                    'dimensions': ['search_type', 'query'],
                    'dimensionFilterGroups': [{
                        'filters': [{
                            'dimension': 'search_type',
                            'operator': 'equals',
                            'expression': 'video'
                        }]
                    }],
                    'rowLimit': 50
                }
            )
            response = request.execute()

            rows = response.get('rows', [])

            # Calculate video search totals
            total_clicks = sum(row.get('clicks', 0) for row in rows)
            total_impressions = sum(row.get('impressions', 0) for row in rows)
            total_ctr = total_clicks / total_impressions if total_impressions > 0 else 0

            # Get video search queries
            video_queries = [
                {
                    'query': row.get('keys', [''])[1],  # Second key is the query
                    'clicks': row.get('clicks', 0),
                    'impressions': row.get('impressions', 0),
                    'ctr': row.get('ctr', 0),
                    'position': row.get('position', 0)
                }
                for row in rows
            ]

            # Also get general search data that might include video results
            general_request = service.searchanalytics().query(
                siteUrl=site_url,
                body={
                    'startDate': start_date,
                    'endDate': end_date,
                    'dimensions': ['page'],
                    'rowLimit': 100
                }
            )
            general_response = general_request.execute()
            general_rows = general_response.get('rows', [])

            # Find pages that might be video pages (containing video content)
            video_pages = []
            for row in general_rows:
                page_url = row.get('keys', [''])[0]
                # Check if this might be a video page (simple heuristic)
                if any(keyword in page_url.lower() for keyword in ['video', 'blog']):
                    video_pages.append({
                        'page': page_url,
                        'clicks': row.get('clicks', 0),
                        'impressions': row.get('impressions', 0),
                        'ctr': row.get('ctr', 0),
                        'position': row.get('position', 0)
                    })

            return {
                'video_search': {
                    'clicks': total_clicks,
                    'impressions': total_impressions,
                    'ctr': total_ctr,
                    'queries': video_queries
                },
                'potential_video_pages': video_pages,
                'period': {
                    'start_date': start_date,
                    'end_date': end_date
                }
            }

        except HttpError as e:
            print(f"[SearchConsole] Video analytics API error: {e}")
            return {
                'error': f'API Error: {e}',
                'video_search': {'clicks': 0, 'impressions': 0, 'ctr': 0, 'queries': []},
                'potential_video_pages': []
            }
        except Exception as e:
            print(f"[SearchConsole] Video analytics failed: {e}")
            return {
                'error': str(e),
                'video_search': {'clicks': 0, 'impressions': 0, 'ctr': 0, 'queries': []},
                'potential_video_pages': []
            }

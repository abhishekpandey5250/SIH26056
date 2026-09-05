import os
import random
import time
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Union

from primp import Client
import fast_flights.parser as parser_module
from fast_flights import (
    create_query,
    get_flights,
    FlightQuery,
    Passengers,
    Query,
    ResultList,
)
from fast_flights.model import Flights
from fast_flights.fetcher import URL, FetchIntegration
from fast_flights.integrations.bright_data import BrightData
from fast_flights.exceptions import FlightsNotFound

logger = logging.getLogger("fast_flights_scraper")

# --- Enhanced JS Parser Patch for Exact Flight Numbers ---
_orig_parse_js = parser_module.parse_js

def _enhanced_parse_js(js: str):
    """
    Patches fast_flights.parser.parse_js to extract exact flight numbers
    (e.g., '6E-449', 'AI-805', 'QP-1518') directly from raw JS payload field[22].
    """
    try:
        data = js.split("data:", 1)[1].rsplit(",", 1)[0]
        payload = json.loads(data)
    except Exception:
        return _orig_parse_js(js)

    res = _orig_parse_js(js)

    if not payload or len(payload) <= 3 or payload[3][0] is None:
        return res

    for k_idx, k in enumerate(payload[3][0]):
        if k_idx >= len(res):
            break
        flight_data = k[0]
        sg_list = flight_data[2]
        flight_obj = res[k_idx]

        flight_nums = []
        for single_sg in sg_list:
            if len(single_sg) > 22 and isinstance(single_sg[22], list) and len(single_sg[22]) >= 2:
                code = single_sg[22][0]
                num = single_sg[22][1]
                if code and num:
                    flight_nums.append(f"{code}-{num}")

        flight_obj.flight_number = ", ".join(flight_nums) if flight_nums else None

    return res

# Apply patch
parser_module.parse_js = _enhanced_parse_js


# Paired Browser Fingerprints & Matched User-Agent Headers to bypass bot signatures
BROWSER_PROFILES = [
    {
        "impersonate": "chrome_131",
        "os": "windows",
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "sec_ch_ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "sec_ch_ua_platform": '"Windows"',
        "accept_language": "en-US,en;q=0.9",
    },
    {
        "impersonate": "chrome_130",
        "os": "macos",
        "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "sec_ch_ua": '"Google Chrome";v="130", "Chromium";v="130", "Not_A Brand";v="99"',
        "sec_ch_ua_platform": '"macOS"',
        "accept_language": "en-US,en;q=0.9,en-GB;q=0.8",
    },
    {
        "impersonate": "chrome_124",
        "os": "windows",
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "sec_ch_ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        "sec_ch_ua_platform": '"Windows"',
        "accept_language": "en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    {
        "impersonate": "firefox_128",
        "os": "linux",
        "user_agent": "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
        "sec_ch_ua": None,
        "sec_ch_ua_platform": None,
        "accept_language": "en-US,en;q=0.5",
    },
    {
        "impersonate": "safari_17",
        "os": "macos",
        "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
        "sec_ch_ua": None,
        "sec_ch_ua_platform": None,
        "accept_language": "en-US,en;q=0.9",
    },
    {
        "impersonate": "edge_127",
        "os": "windows",
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0",
        "sec_ch_ua": '"Microsoft Edge";v="127", "Chromium";v="127", "Not=A?Brand";v="99"',
        "sec_ch_ua_platform": '"Windows"',
        "accept_language": "en-US,en;q=0.9",
    },
]

REFERERS = [
    "https://www.google.com/",
    "https://www.google.com/travel/flights",
    "https://www.google.co.in/",
    "https://www.google.com/search?q=google+flights",
]


class HumanizedFetcher(FetchIntegration):
    """
    Humanized Fetcher with authentic browser TLS fingerprinting & realistic operational pacing.
    """

    def __init__(
        self,
        delay_range: tuple[float, float] = (2.5, 6.8),
        proxy: Optional[str] = None,
        bright_data_key: Optional[str] = None,
        verbose: bool = False,
        quiet: bool = False,
    ):
        self.min_delay, self.max_delay = delay_range
        self.proxy = proxy
        self.bright_data_key = bright_data_key
        self.verbose = verbose
        self.quiet = quiet

    def apply_pacing_delay(self):
        """Simulates natural user typing, page reading, & navigation pause."""
        delay = random.uniform(self.min_delay, self.max_delay)
        if not self.quiet:
            print(f"[Human Pacing] Pausing {delay:.2f}s (simulating natural typing & navigation)...")
        time.sleep(delay)

    def fetch_html(self, q: Union[Query, str]) -> str:
        # Step 1: Apply human operational pacing delay
        self.apply_pacing_delay()

        # Step 2: Pick matched browser profile (TLS fingerprint + UA + Headers)
        profile = random.choice(BROWSER_PROFILES)
        referer = random.choice(REFERERS)

        headers = {
            "User-Agent": profile["user_agent"],
            "Accept-Language": profile["accept_language"],
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Referer": referer,
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "cross-site" if "search?" in referer else "same-origin",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
        }

        if profile["sec_ch_ua"]:
            headers["Sec-Ch-Ua"] = profile["sec_ch_ua"]
            headers["Sec-Ch-Ua-Mobile"] = "?0"
            headers["Sec-Ch-Ua-Platform"] = profile["sec_ch_ua_platform"]

        if self.verbose:
            logger.info(f"[Fetch] Requesting via primp (Profile: {profile['impersonate']}/{profile['os']}, Ref: {referer})")

        try:
            client = Client(
                impersonate=profile["impersonate"], # type: ignore
                impersonate_os=profile["os"],       # type: ignore
                referer=True,
                proxy=self.proxy,
                cookie_store=True,
                headers=headers,
            )

            if isinstance(q, Query):
                params = q.params()
            else:
                params = {"q": q}

            res = client.get(URL, params=params)

            if res.status_code != 200:
                raise RuntimeError(f"HTTP error status {res.status_code}")

            return res.text

        except Exception as err:
            logger.warning(f"[Fetch Warning] Direct fetch failed or blocked ({err}). Attempting fallback...")

            if self.bright_data_key:
                logger.info("[Fallback] Routing request through Bright Data SERP Integration...")
                bd = BrightData(api_key=self.bright_data_key)
                return bd.fetch_html(q)

            raise err


def calculate_lead_time_days(scraped_at_str: str, departure_date_str: str) -> int:
    """Calculates integer calendar lead time days: departure_date - scraped_at_date."""
    try:
        if "+" in scraped_at_str or "Z" in scraped_at_str:
            scraped_dt = datetime.fromisoformat(scraped_at_str.replace("Z", "+00:00"))
            scraped_date = scraped_dt.date()
        else:
            scraped_date = datetime.strptime(scraped_at_str[:10], "%Y-%m-%d").date()

        dep_date = datetime.strptime(departure_date_str, "%Y-%m-%d").date()
        return (dep_date - scraped_date).days
    except Exception:
        return 0


def segregate_observations(observations: List[Dict[str, Any]], output_dir: str) -> Dict[str, Dict[str, int]]:
    """
    Segregates scraped observations by:
      1. Time Window subfolder (e.g. T+1/, T+7/, T+15/, T+30/, T+45/)
      2. Route file inside that folder (e.g. DEL_BOM.json)
    """
    os.makedirs(output_dir, exist_ok=True)
    grouped: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}

    for obs in observations:
        scraped_at = obs.get("scraped_at", "")
        dep_date = obs.get("departure_date", "")
        origin = obs.get("origin", "UNKNOWN").upper()
        dest = obs.get("destination", "UNKNOWN").upper()

        days = calculate_lead_time_days(scraped_at, dep_date)
        window = f"T+{days}" if days >= 0 else f"T{days}"
        route = f"{origin}_{dest}"

        if window not in grouped:
            grouped[window] = {}
        if route not in grouped[window]:
            grouped[window][route] = []

        grouped[window][route].append(obs)

    summary: Dict[str, Dict[str, int]] = {}

    for window, routes in sorted(grouped.items()):
        window_dir = os.path.join(output_dir, window)
        os.makedirs(window_dir, exist_ok=True)
        summary[window] = {}

        for route, obs_list in sorted(routes.items()):
            filename = f"{route}.json"
            filepath = os.path.join(window_dir, filename)

            content = {
                "window": window,
                "route": route.replace("_", "-"),
                "origin": obs_list[0].get("origin"),
                "destination": obs_list[0].get("destination"),
                "total_observations": len(obs_list),
                "observations": obs_list,
            }

            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(content, f, indent=2, ensure_ascii=False)

            summary[window][route] = len(obs_list)

    return summary


class FlightScraper:
    """
    Autonomous Flight Scraping Agent built on fast-flights.
    Supports single search or batch group searches with data segregation.
    """

    def __init__(
        self,
        delay_range: tuple[float, float] = (2.5, 6.8),
        proxy: Optional[str] = None,
        bright_data_key: Optional[str] = None,
        verbose: bool = False,
        quiet: bool = False,
    ):
        self.fetcher = HumanizedFetcher(
            delay_range=delay_range,
            proxy=proxy,
            bright_data_key=bright_data_key,
            verbose=verbose,
            quiet=quiet,
        )
        self.verbose = verbose
        self.quiet = quiet

    @staticmethod
    def format_currency_raw(price: float, currency: str) -> str:
        symbol_map = {
            "INR": "₹",
            "USD": "$",
            "EUR": "€",
            "GBP": "£",
            "CAD": "C$",
            "AUD": "A$",
        }
        sym = symbol_map.get(currency.upper(), f"{currency.upper()} ")
        try:
            formatted_val = f"{int(price):,}"
        except Exception:
            formatted_val = str(price)

        if sym.endswith(" "):
            return f"{sym}{formatted_val}"
        return f"{sym}{formatted_val}"

    def search_flights(
        self,
        origin: str,
        destination: str,
        date: str,
        return_date: Optional[str] = None,
        seat_class: str = "economy",
        trip_type: str = "one-way",
        passengers: int = 1,
        currency: str = "INR",
        language: str = "en-US",
    ) -> Dict[str, Any]:
        """
        Executes a single Google Flights search and returns standardized observations JSON dictionary.
        """
        origin = origin.strip().upper()
        destination = destination.strip().upper()
        seat_class = seat_class.lower()
        trip_type = trip_type.lower()

        flight_queries = [
            FlightQuery(
                date=date,
                from_airport=origin,
                to_airport=destination,
            )
        ]

        if trip_type == "round-trip" and return_date:
            flight_queries.append(
                FlightQuery(
                    date=return_date,
                    from_airport=destination,
                    to_airport=origin,
                )
            )

        query = create_query(
            flights=flight_queries,
            seat=seat_class,  # type: ignore
            trip=trip_type,    # type: ignore
            passengers=Passengers(adults=passengers),
            currency=currency,
            language=language,
        )

        search_url = query.url()
        scraped_at = datetime.now(timezone.utc).isoformat()

        if self.verbose:
            logger.info(f"[Query Built] Route: {origin} -> {destination} ({date}), URL: {search_url}")

        try:
            results: ResultList = get_flights(query, integration=self.fetcher)
        except FlightsNotFound:
            if not self.quiet:
                print(f"[No Flights] No flight offers found for {origin} -> {destination} on {date}")
            return {"observations": []}
        except Exception as e:
            logger.error(f"[Error] Failed to fetch flights for {origin} -> {destination}: {e}")
            return {"observations": []}

        observations: List[Dict[str, Any]] = []

        for f in results:
            obs = self._transform_flight_to_observation(
                f=f,
                query_origin=origin,
                query_dest=destination,
                query_date=date,
                return_date=return_date,
                trip_type=trip_type,
                seat_class=seat_class,
                passengers=passengers,
                currency=currency,
                search_url=search_url,
                scraped_at=scraped_at,
            )
            observations.append(obs)

        return {"observations": observations}

    def search_batch(self, queries: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Executes a group/batch of flight queries for multiple routes with humanized pacing between requests.
        """
        all_observations: List[Dict[str, Any]] = []
        total_queries = len(queries)

        if not self.quiet:
            print(f"[Batch Start] Executing search for {total_queries} route queries with humanized operational pacing...")

        for idx, item in enumerate(queries, 1):
            origin = item.get("origin")
            destination = item.get("destination")
            date = item.get("date")

            if not origin or not destination or not date:
                logger.warning(f"[Skipped Query #{idx}] Invalid query spec (missing origin/destination/date): {item}")
                continue

            if not self.quiet:
                print(f"\n[Query {idx}/{total_queries}] Scraping Route: {origin} -> {destination} on {date}")

            res = self.search_flights(
                origin=origin,
                destination=destination,
                date=date,
                return_date=item.get("return_date"),
                seat_class=item.get("seat_class", "economy"),
                trip_type=item.get("trip_type", "one-way"),
                passengers=item.get("passengers", 1),
                currency=item.get("currency", "INR"),
                language=item.get("language", "en-US"),
            )

            obs_count = len(res.get("observations", []))
            all_observations.extend(res.get("observations", []))

            if not self.quiet:
                print(f"[Query {idx}/{total_queries} Completed] Retrieved {obs_count} flight observations.")

        return {"observations": all_observations}

    def _transform_flight_to_observation(
        self,
        f: Flights,
        query_origin: str,
        query_dest: str,
        query_date: str,
        return_date: Optional[str],
        trip_type: str,
        seat_class: str,
        passengers: int,
        currency: str,
        search_url: str,
        scraped_at: str,
    ) -> Dict[str, Any]:
        if f.airlines:
            airline = ", ".join(f.airlines)
        else:
            airline = "Unknown"

        source = airline

        flight_number = getattr(f, "flight_number", None)
        if not flight_number and f.type and f.type != "multi":
            flight_number = f.type

        first_segment = f.flights[0] if f.flights else None
        last_segment = f.flights[-1] if f.flights else None

        dep_origin = first_segment.from_airport.code if first_segment else query_origin
        arr_dest = last_segment.to_airport.code if last_segment else query_dest

        if first_segment and hasattr(first_segment.departure, "date"):
            y, m, d = first_segment.departure.date
            dep_date_str = f"{y:04d}-{m:02d}-{d:02d}"
        else:
            dep_date_str = query_date

        if first_segment and hasattr(first_segment.departure, "time"):
            dh, dm = first_segment.departure.time
            dep_time_str = f"{dh:02d}:{dm:02d}"
        else:
            dep_time_str = "00:00"

        if last_segment and hasattr(last_segment.arrival, "time"):
            ah, am = last_segment.arrival.time
            arr_time_str = f"{ah:02d}:{am:02d}"
        else:
            arr_time_str = "00:00"

        duration_minutes = 0
        if first_segment and last_segment:
            try:
                dep_dt = datetime(
                    first_segment.departure.date[0],
                    first_segment.departure.date[1],
                    first_segment.departure.date[2],
                    first_segment.departure.time[0],
                    first_segment.departure.time[1],
                )
                arr_dt = datetime(
                    last_segment.arrival.date[0],
                    last_segment.arrival.date[1],
                    last_segment.arrival.date[2],
                    last_segment.arrival.time[0],
                    last_segment.arrival.time[1],
                )
                diff = int((arr_dt - dep_dt).total_seconds() // 60)
                if diff > 0:
                    duration_minutes = diff
                else:
                    duration_minutes = sum(sg.duration for sg in f.flights if sg.duration)
            except Exception:
                duration_minutes = sum(sg.duration for sg in f.flights if sg.duration)
        else:
            duration_minutes = sum(sg.duration for sg in f.flights if sg.duration)

        hrs = duration_minutes // 60
        mins = duration_minutes % 60
        if hrs > 0 and mins > 0:
            duration_str = f"{hrs} hr {mins} min"
        elif hrs > 0:
            duration_str = f"{hrs} hr"
        else:
            duration_str = f"{mins} min"

        stops = max(0, len(f.flights) - 1)

        price_num = float(f.price) if f.price else 0.0
        price_raw = self.format_currency_raw(price_num, currency)

        co2_str = None
        if hasattr(f, "carbon") and f.carbon and getattr(f.carbon, "emission", None):
            kg = f.carbon.emission // 1000
            co2_str = f"{kg} kg CO2"

        return {
            "source": source,
            "scraped_at": scraped_at,
            "origin": dep_origin,
            "destination": arr_dest,
            "departure_date": dep_date_str,
            "return_date": return_date,
            "trip_type": trip_type,
            "cabin_class": seat_class,
            "passengers": passengers,
            "airline": airline,
            "flight_number": flight_number if flight_number else None,
            "departure_time": dep_time_str,
            "arrival_time": arr_time_str,
            "duration": duration_str,
            "duration_minutes": duration_minutes,
            "stops": stops,
            "price": int(price_num) if price_num.is_integer() else price_num,
            "currency": currency.upper(),
            "price_raw": price_raw,
            "search_url": search_url,
            "co2_emissions": co2_str,
        }

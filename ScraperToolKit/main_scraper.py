import sys
import os
import json
import csv
import argparse
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

# Ensure standard output supports UTF-8 on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from scraper import FlightScraper, segregate_observations


def parse_routes_argument(routes_list: List[str], date_str: Optional[str], lead_times_str: Optional[str], default_opts: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Parses CLI route strings like 'DEL-BOM' or 'DEL:BOM' into query dictionaries.
    Supports expanding lead-times (e.g. T+1, T+7, T+15, T+30, T+45).
    """
    dates_to_use: List[str] = []

    if lead_times_str:
        today = datetime.now(timezone.utc).date()
        offsets = [int(x.strip()) for x in lead_times_str.split(",") if x.strip().isdigit()]
        dates_to_use = [(today + timedelta(days=o)).strftime("%Y-%m-%d") for o in offsets]
    elif date_str:
        dates_to_use = [date_str.strip()]
    else:
        default_date = (datetime.now(timezone.utc).date() + timedelta(days=7)).strftime("%Y-%m-%d")
        dates_to_use = [default_date]

    queries: List[Dict[str, Any]] = []

    for route in routes_list:
        clean_route = route.replace(":", "-").upper()
        parts = clean_route.split("-")
        if len(parts) == 2:
            orig, dest = parts[0].strip(), parts[1].strip()
            for d in dates_to_use:
                q = {
                    "origin": orig,
                    "destination": dest,
                    "date": d,
                    "return_date": default_opts.get("return_date"),
                    "seat_class": default_opts.get("seat_class", "economy"),
                    "trip_type": default_opts.get("trip_type", "one-way"),
                    "passengers": default_opts.get("passengers", 1),
                    "currency": default_opts.get("currency", "INR"),
                }
                queries.append(q)

    return queries


def load_input_file(filepath: str) -> List[Dict[str, Any]]:
    """
    Loads flight route queries from a JSON or CSV file.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Input file not found: {filepath}")

    ext = os.path.splitext(filepath)[1].lower()
    queries: List[Dict[str, Any]] = []

    if ext == ".json":
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                queries = data
            elif isinstance(data, dict) and "queries" in data:
                queries = data["queries"]
            elif isinstance(data, dict) and "routes" in data:
                queries = data["routes"]
            elif isinstance(data, dict) and "observations" in data:
                queries = data["observations"]
            else:
                queries = [data]

    elif ext == ".csv":
        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                queries.append(dict(row))

    else:
        raise ValueError(f"Unsupported file format '{ext}'. Please use .json or .csv files.")

    return queries


def expand_queries_with_lead_times(queries: List[Dict[str, Any]], lead_times_str: Optional[str], date_override: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    If lead_times_str is specified (e.g. 1,7,15,30,45), expands loaded file route queries
    across target lead-time departure dates (T+1, T+7, T+15, T+30, T+45) relative to today.
    """
    if not lead_times_str and not date_override:
        return queries

    dates_to_use: List[str] = []
    if lead_times_str:
        today = datetime.now(timezone.utc).date()
        offsets = [int(x.strip()) for x in lead_times_str.split(",") if x.strip().isdigit()]
        dates_to_use = [(today + timedelta(days=o)).strftime("%Y-%m-%d") for o in offsets]
    elif date_override:
        dates_to_use = [date_override.strip()]

    expanded: List[Dict[str, Any]] = []
    seen_combinations = set()

    for item in queries:
        orig = item.get("origin")
        dest = item.get("destination")
        if not orig or not dest:
            continue

        for target_date in dates_to_use:
            combo_key = (orig, dest, target_date)
            if combo_key in seen_combinations:
                continue
            seen_combinations.add(combo_key)

            q_copy = dict(item)
            q_copy["date"] = target_date
            expanded.append(q_copy)

    return expanded


def interactive_input() -> List[Dict[str, Any]]:
    """
    Interactively prompts the user for flight route inputs.
    """
    print("\n--- Autonomous Google Flights Scraper Agent ---")
    print("Enter flight search details (press Enter to skip optional fields).\n")

    routes_input = input("Enter route(s) (e.g. 'DEL-BOM' or 'DEL-BOM BOM-BLR DEL-CCU'): ").strip()
    if not routes_input:
        print("No routes specified. Exiting.")
        sys.exit(0)

    date_input = input("Enter departure date (YYYY-MM-DD, default: 7 days from today): ").strip()
    if not date_input:
        date_input = (datetime.now(timezone.utc).date() + timedelta(days=7)).strftime("%Y-%m-%d")

    seat_class = input("Enter seat class (economy/premium-economy/business/first, default: economy): ").strip() or "economy"
    trip_type = input("Enter trip type (one-way/round-trip, default: one-way): ").strip() or "one-way"
    currency = input("Enter currency code (default: INR): ").strip() or "INR"

    routes_list = routes_input.split()
    return parse_routes_argument(
        routes_list=routes_list,
        date_str=date_input,
        lead_times_str=None,
        default_opts={
            "seat_class": seat_class,
            "trip_type": trip_type,
            "currency": currency,
            "passengers": 1,
        }
    )


def main():
    parser = argparse.ArgumentParser(
        description="Generalized Autonomous Google Flights Scraper Agent built on fast-flights."
    )
    # Route input options
    parser.add_argument("--routes", nargs="+", help="Multiple routes (e.g. --routes DEL-BOM BOM-BLR DEL-CCU)")
    parser.add_argument("--origin", type=str, default=None, help="3-letter IATA origin code (e.g. DEL)")
    parser.add_argument("--destination", type=str, default=None, help="3-letter IATA destination code (e.g. BOM)")
    parser.add_argument("--date", type=str, default=None, help="Departure date in YYYY-MM-DD format")
    parser.add_argument("--lead-times", type=str, default=None, help="Comma-separated lead time days (e.g. 1,7,15,30,45)")
    parser.add_argument("-i", "--input-file", type=str, default=None, help="Path to JSON or CSV file containing route queries")

    # Offline file segregation option
    parser.add_argument("-s", "--segregate-file", type=str, default=None, help="Segregate an existing batch JSON file into time-window and route folders")

    # Optional query parameters
    parser.add_argument("--return-date", type=str, default=None, help="Return date in YYYY-MM-DD format for round-trip")
    parser.add_argument("--seat-class", type=str, default="economy", choices=["economy", "premium-economy", "business", "first"], help="Seat class")
    parser.add_argument("--trip-type", type=str, default="one-way", choices=["one-way", "round-trip", "multi-city"], help="Trip type")
    parser.add_argument("--passengers", type=int, default=1, help="Passenger count (default: 1)")
    parser.add_argument("--currency", type=str, default="INR", help="3-letter currency code (default: INR)")

    # Anti-bot & humanization execution controls
    parser.add_argument("--proxy", type=str, default=None, help="Proxy URL (e.g., http://user:pass@host:port)")
    parser.add_argument("--bright-data-key", type=str, default=None, help="Bright Data API Key for fallback routing")
    parser.add_argument("--delay-min", type=float, default=2.5, help="Minimum humanized delay in seconds (default: 2.5)")
    parser.add_argument("--delay-max", type=float, default=6.8, help="Maximum humanized delay in seconds (default: 6.8)")

    # Output options
    parser.add_argument("--output", "-o", type=str, default=None, help="Path to save aggregated output JSON file")
    parser.add_argument("--output-dir", "-d", type=str, default=None, help="Directory path to save segregated route & time-window files (e.g. scraped_data/)")
    parser.add_argument("--json-only", action="store_true", help="Output strictly clean JSON without log output")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose operational logging")

    args = parser.parse_args()

    # Mode 1: Offline Segregation of existing JSON file
    if args.segregate_file:
        if not os.path.exists(args.segregate_file):
            print(f"Error: File to segregate not found: {args.segregate_file}", file=sys.stderr)
            sys.exit(1)

        out_dir = args.output_dir or "scraped_data"
        with open(args.segregate_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        observations = data.get("observations", []) if isinstance(data, dict) else data
        summary = segregate_observations(observations, out_dir)

        print(f"\n--- Data Segregation Completed ---")
        print(f"Source File: {args.segregate_file}")
        print(f"Target Directory: {os.path.abspath(out_dir)}")
        print("Segregation Breakdown by Window & Route:")
        for window, routes in summary.items():
            print(f"\n  📁 Folder: {window}/")
            for route, count in routes.items():
                print(f"     📄 {route}.json -> {count} observations")
        sys.exit(0)

    # Mode 2: Live Scraping (Single or Batch)
    log_level = logging.INFO if (args.verbose and not args.json_only) else logging.WARNING
    logging.basicConfig(level=log_level, format="%(asctime)s [%(levelname)s] %(message)s")

    default_opts = {
        "return_date": args.return_date,
        "seat_class": args.seat_class,
        "trip_type": args.trip_type,
        "passengers": args.passengers,
        "currency": args.currency,
    }

    queries: List[Dict[str, Any]] = []

    if args.input_file:
        loaded_queries = load_input_file(args.input_file)
        queries = expand_queries_with_lead_times(loaded_queries, args.lead_times, args.date)
    elif args.routes:
        queries = parse_routes_argument(args.routes, args.date, args.lead_times, default_opts)
    elif args.origin and args.destination:
        route_str = f"{args.origin}-{args.destination}"
        queries = parse_routes_argument([route_str], args.date, args.lead_times, default_opts)
    else:
        if sys.stdin.isatty():
            queries = interactive_input()
        else:
            print("Error: No route inputs specified. Pass --routes, --origin & --destination, or -i input_file.", file=sys.stderr)
            sys.exit(1)

    if not queries:
        print("No valid route queries to process.", file=sys.stderr)
        sys.exit(1)

    # Initialize Autonomous Scraper Engine
    scraper = FlightScraper(
        delay_range=(args.delay_min, args.delay_max),
        proxy=args.proxy,
        bright_data_key=args.bright_data_key,
        verbose=args.verbose and not args.json_only,
        quiet=args.json_only,
    )

    result_data = scraper.search_batch(queries)

    # If --output-dir is specified, segregate observations into time window & route folders
    if args.output_dir:
        seg_summary = segregate_observations(result_data.get("observations", []), args.output_dir)
        if not args.json_only:
            print(f"\n--- Data Segregation Completed ---")
            print(f"Target Directory: {os.path.abspath(args.output_dir)}")
            print("Segregation Breakdown by Window & Route:")
            for window, routes in seg_summary.items():
                print(f"\n  📁 Folder: {window}/")
                for route, count in routes.items():
                    print(f"     📄 {route}.json -> {count} observations")

    json_output = json.dumps(result_data, indent=2, ensure_ascii=False)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(json_output)
        if not args.json_only:
            print(f"\nAggregated batch output saved to {args.output}")

    if args.json_only or not args.output:
        print(json_output)


if __name__ == "__main__":
    main()
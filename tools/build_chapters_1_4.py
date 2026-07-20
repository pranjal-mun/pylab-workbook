#!/usr/bin/env python3
"""Build the first four PyLab Workbook chapter catalogs from explicit contracts."""

from __future__ import annotations

import ast
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def arg(name: str, type_: str, description: str, default: str | None = None) -> dict:
    return {"name": name, "type": type_, "description": description, "default": default}


def case(name: str, call: str, expected: str, approximate: bool = False) -> dict:
    return {"name": name, "call": call, "expected": expected, "approximate": approximate}


def problem(number: str, slug: str, title: str, summary: str, context: str, rules: str,
            args: list[dict], return_type: str, return_description: str, example_call: str,
            example_output: str, cases: list[dict], concepts: list[str], difficulty: str = "Beginner",
            raises: list[tuple[str, str]] | None = None, imports: list[str] | None = None) -> dict:
    return locals()


def signature(spec: dict) -> str:
    rendered = []
    for item in spec["args"]:
        text = f'{item["name"]}: {item["type"]}'
        if item["default"] is not None:
            text += f' = {item["default"]}'
        rendered.append(text)
    return f'def {spec["slug"]}({", ".join(rendered)}) -> {spec["return_type"]}:'


def starter(spec: dict) -> str:
    lines = [*(spec["imports"] or []), ""] if spec["imports"] else []
    lines += [signature(spec), f'    """{spec["summary"]}', ""]
    if spec["args"]:
        lines.append("    Args:")
        for item in spec["args"]:
            lines.append(f'        {item["name"]} ({item["type"]}): {item["description"]}')
        lines.append("")
    lines += ["    Returns:", f'        {spec["return_type"]}: {spec["return_description"]}']
    if spec["raises"]:
        lines += ["", "    Raises:"]
        lines += [f"        {kind}: {description}" for kind, description in spec["raises"]]
    lines += ['    """', "    pass", ""]
    return "\n".join(lines)


def build_problem(section: dict, spec: dict) -> dict:
    parameters = "\n".join(
        f'• {item["name"]} ({item["type"]}): {item["description"]}' for item in spec["args"]
    ) or "• This function does not require arguments."
    prompt = (
        f'{spec["context"]}\n\n'
        f'Background and required method:\n{spec["rules"]}\n\n'
        f'Implement this interface:\n{signature(spec)}\n\n'
        f'Parameters:\n{parameters}\n\n'
        f'Expected result:\n{spec["return_description"]}'
    )
    tests = []
    for item in spec["cases"]:
        if item["approximate"]:
            code = f"actual = {item['call']}\nexpected = {item['expected']}\nassert abs(actual - expected) < 1e-9, f'Expected {{expected}}, got {{actual}}.'"
        else:
            code = f"assert {item['call']} == {item['expected']}"
        tests.append({"name": item["name"], "stdin": "", "moduleMode": True, "code": code})
    identifier = f'{section["id"]}-{spec["slug"].replace("_", "-")}'
    return {
        "id": identifier,
        "number": spec["number"],
        "title": spec["title"],
        "category": section["category"],
        "difficulty": spec["difficulty"],
        "prompt": prompt,
        "signature": signature(spec),
        "concepts": spec["concepts"],
        "examples": [{"input": spec["example_call"], "output": spec["example_output"]}],
        "starterFiles": [{"name": "main.py", "content": starter(spec)}],
        "tests": tests,
    }


BASICS = [
    problem("1.5", "deposit_refund", "Container Deposit Refund", "Calculate the refund for returned drink containers.", "A recycling depot pays 10 cents for containers holding at most one litre and 25 cents for larger containers.", "Both counts must be non-negative integers. Calculate the refund in dollars and round it to two decimal places.", [arg("small", "int", "Number of containers holding one litre or less."), arg("large", "int", "Number of containers holding more than one litre.")], "float", "The refund amount in dollars, rounded to two decimals.", "deposit_refund(8, 3)", "1.55", [case("mixed containers", "deposit_refund(8, 3)", "1.55"), case("only small containers", "deposit_refund(10, 0)", "1.0"), case("empty return", "deposit_refund(0, 0)", "0.0")], ["arithmetic", "currency", "rounding"]),
    problem("1.6", "restaurant_total", "Tax and Tip", "Calculate tax, tip, and the final restaurant bill.", "A restaurant calculates both sales tax and a tip from the meal's original price.", "Use the supplied decimal rates, not percentages. Round each monetary result to two decimal places before returning it.", [arg("meal_cost", "float", "Pre-tax cost of the meal in dollars."), arg("tax_rate", "float", "Sales-tax rate as a decimal.", "0.05"), arg("tip_rate", "float", "Tip rate as a decimal.", "0.18")], "tuple[float, float, float]", "The tax, tip, and final total in dollars.", "restaurant_total(50.0)", "(2.5, 9.0, 61.5)", [case("standard meal", "restaurant_total(50.0)", "(2.5, 9.0, 61.5)"), case("small meal", "restaurant_total(10.0)", "(0.5, 1.8, 12.3)"), case("custom rates", "restaurant_total(100.0, 0.15, 0.2)", "(15.0, 20.0, 135.0)")], ["arithmetic", "percentages", "currency"]),
    problem("1.7", "sum_to_n", "Sum the First n Integers", "Calculate the sum of the positive integers from 1 through n.", "The sequence 1 + 2 + ... + n has a direct arithmetic formula.", "Use n * (n + 1) // 2 rather than a loop. n is a non-negative integer.", [arg("n", "int", "Inclusive upper bound of the sequence.")], "int", "The sum from 1 through n; zero when n is zero.", "sum_to_n(100)", "5050", [case("first hundred", "sum_to_n(100)", "5050"), case("single value", "sum_to_n(1)", "1"), case("zero", "sum_to_n(0)", "0")], ["integer arithmetic", "formula"]),
    problem("1.8", "shipment_weight", "Widget Shipment Weight", "Calculate the total weight of a widget and gizmo shipment.", "Each widget weighs 75 grams and each gizmo weighs 112 grams.", "Multiply each non-negative item count by its unit weight and add the results.", [arg("widgets", "int", "Number of 75-gram widgets."), arg("gizmos", "int", "Number of 112-gram gizmos.")], "int", "Total shipment weight in grams.", "shipment_weight(3, 2)", "449", [case("mixed shipment", "shipment_weight(3, 2)", "449"), case("widgets only", "shipment_weight(4, 0)", "300"), case("empty shipment", "shipment_weight(0, 0)", "0")], ["multiplication", "units"]),
    problem("1.9", "account_balances", "Compound Interest Forecast", "Project an account balance over several years of annual compounding.", "Interest is added to the account once per year, and the next year's interest is calculated from the new balance.", "Return one rounded balance for each year. The default annual rate is 4 percent and years must be non-negative.", [arg("principal", "float", "Initial account balance."), arg("years", "int", "Number of annual balances to calculate.", "3"), arg("rate", "float", "Annual interest rate as a decimal.", "0.04")], "list[float]", "Year-end balances rounded to two decimal places.", "account_balances(1000.0)", "[1040.0, 1081.6, 1124.86]", [case("three years", "account_balances(1000.0)", "[1040.0, 1081.6, 1124.86]"), case("one year", "account_balances(250.0, 1)", "[260.0]"), case("no years", "account_balances(500.0, 0)", "[]")], ["compound interest", "lists", "rounding"]),
    problem("1.10", "arithmetic_report", "Arithmetic Report", "Calculate a collection of arithmetic results for two integers.", "A compact arithmetic report is useful for practising Python's basic numeric operators.", "Return sum, first-minus-second, product, quotient, remainder, log10 of the first value, and first raised to the second. The first value must be positive and the second non-zero.", [arg("first", "int", "Positive first integer."), arg("second", "int", "Non-zero second integer.")], "tuple[float, ...]", "Seven results in the order stated in the task.", "arithmetic_report(10, 3)", "(13, 7, 30, 3.333..., 1, 1.0, 1000)", [case("integer operations", "arithmetic_report(10, 2)", "(12, 8, 20, 5.0, 0, 1.0, 100)"), case("different values", "arithmetic_report(8, 3)[:3]", "(11, 5, 24)"), case("remainder", "arithmetic_report(17, 5)[4]", "2")], ["operators", "logarithms", "tuples"], "Intermediate", imports=["import math"]),
    problem("1.11", "mpg_to_l_per_100km", "Fuel Efficiency Converter", "Convert miles per gallon to litres per 100 kilometres.", "Canada commonly reports fuel consumption in L/100 km while the United States often uses miles per gallon.", "Use the conversion 235.215 / mpg. mpg must be positive.", [arg("mpg", "float", "Fuel efficiency in US miles per gallon.")], "float", "Equivalent litres consumed per 100 kilometres.", "mpg_to_l_per_100km(30)", "7.8405", [case("thirty mpg", "mpg_to_l_per_100km(30)", "7.8405", True), case("efficient vehicle", "mpg_to_l_per_100km(50)", "4.7043", True), case("one mpg", "mpg_to_l_per_100km(1)", "235.215", True)], ["unit conversion", "division"]),
    problem("1.12", "earth_distance", "Distance Across Earth", "Calculate great-circle distance between two latitude-longitude points.", "Locations on Earth lie on a sphere, so straight Cartesian distance is not appropriate.", "Convert all angles from degrees to radians and use the spherical law of cosines with Earth radius 6371.01 km.", [arg("lat1", "float", "First latitude in degrees."), arg("lon1", "float", "First longitude in degrees."), arg("lat2", "float", "Second latitude in degrees."), arg("lon2", "float", "Second longitude in degrees.")], "float", "Great-circle distance in kilometres.", "earth_distance(0, 0, 0, 1)", "approximately 111.195", [case("same point", "earth_distance(10, 20, 10, 20)", "0.0", True), case("one degree longitude", "earth_distance(0, 0, 0, 1)", "111.19492664455873", True), case("quarter circumference", "earth_distance(0, 0, 0, 90)", "10007.558398010286", True)], ["trigonometry", "radians", "geography"], "Advanced", imports=["import math"]),
    problem("1.13", "make_change", "Make Change", "Break an amount of cents into Canadian coin denominations.", "A greedy change calculation repeatedly uses the largest coin that does not exceed the remaining amount.", "Use denominations 200, 100, 25, 10, 5, and 1 cents, in that order. Return every denomination as a dictionary key, including zero counts.", [arg("cents", "int", "Non-negative amount to decompose.")], "dict[int, int]", "Coin counts keyed by denomination in descending order.", "make_change(289)", "{200: 1, 100: 0, 25: 3, 10: 1, 5: 0, 1: 4}", [case("mixed change", "make_change(289)", "{200: 1, 100: 0, 25: 3, 10: 1, 5: 0, 1: 4}"), case("exact dollar", "make_change(100)", "{200: 0, 100: 1, 25: 0, 10: 0, 5: 0, 1: 0}"), case("zero", "make_change(0)", "{200: 0, 100: 0, 25: 0, 10: 0, 5: 0, 1: 0}")], ["integer division", "remainder", "dictionaries"]),
    problem("1.14", "height_in_cm", "Height Unit Converter", "Convert a height in feet and inches to centimetres.", "A foot contains 12 inches and one inch is exactly 2.54 centimetres.", "Combine the two measurements before converting. Both inputs must be non-negative.", [arg("feet", "int", "Whole feet in the height."), arg("inches", "float", "Additional inches in the height.")], "float", "Total height in centimetres.", "height_in_cm(5, 8)", "172.72", [case("five foot eight", "height_in_cm(5, 8)", "172.72", True), case("one foot", "height_in_cm(1, 0)", "30.48", True), case("inches only", "height_in_cm(0, 10)", "25.4", True)], ["unit conversion", "arithmetic"]),
    problem("1.15", "distance_conversions", "Distance Unit Converter", "Convert a distance in feet to several related imperial units.", "One foot is 12 inches, one yard is 3 feet, and one mile is 5,280 feet.", "Calculate all three conversions from the original feet value.", [arg("feet", "float", "Distance measured in feet.")], "tuple[float, float, float]", "Equivalent inches, yards, and miles.", "distance_conversions(5280)", "(63360, 1760, 1.0)", [case("one mile", "distance_conversions(5280)", "(63360, 1760.0, 1.0)"), case("three feet", "distance_conversions(3)", "(36, 1.0, 0.0005681818181818182)"), case("zero", "distance_conversions(0)", "(0, 0.0, 0.0)")], ["unit conversion", "tuples"]),
    problem("1.16", "circle_and_sphere", "Circle Area and Sphere Volume", "Calculate measurements associated with a radius.", "The area of a circle is pi*r^2 and the volume of a sphere is 4*pi*r^3/3.", "Use math.pi and a non-negative radius.", [arg("radius", "float", "Radius of both shapes.")], "tuple[float, float]", "Circle area followed by sphere volume.", "circle_and_sphere(2)", "(12.566..., 33.510...)", [case("radius one area", "circle_and_sphere(1)[0]", "3.141592653589793", True), case("radius one volume", "circle_and_sphere(1)[1]", "4.1887902047863905", True), case("zero radius", "circle_and_sphere(0)", "(0.0, 0.0)")], ["geometry", "pi", "powers"], imports=["import math"]),
    problem("1.17", "heating_energy", "Heating Water", "Calculate energy and electricity cost for heating water.", "Water has a specific heat capacity of 4.186 joules per gram per degree Celsius. One kilowatt-hour is 3,600,000 joules.", "Compute q = mass * 4.186 * temperature_change and then price the energy using cents_per_kwh.", [arg("mass_grams", "float", "Mass of water in grams."), arg("temperature_change", "float", "Increase in degrees Celsius."), arg("cents_per_kwh", "float", "Electricity price in cents per kilowatt-hour.", "8.9")], "tuple[float, float]", "Required energy in joules and cost in cents.", "heating_energy(1000, 10)", "(41860.0, approximately 0.1035)", [case("energy", "heating_energy(1000, 10)[0]", "41860.0", True), case("cost", "heating_energy(1000, 10)[1]", "0.10348166666666667", True), case("no change", "heating_energy(500, 0)", "(0.0, 0.0)")], ["physics", "energy", "unit conversion"], "Intermediate"),
    problem("1.18", "cylinder_volume", "Cylinder Volume", "Calculate the volume of a cylinder.", "A cylinder's volume is pi times radius squared times height.", "Use math.pi and round the result to one decimal place as required by the exercise.", [arg("radius", "float", "Non-negative cylinder radius."), arg("height", "float", "Non-negative cylinder height.")], "float", "Cylinder volume rounded to one decimal place.", "cylinder_volume(2, 5)", "62.8", [case("sample cylinder", "cylinder_volume(2, 5)", "62.8"), case("unit cylinder", "cylinder_volume(1, 1)", "3.1"), case("flat cylinder", "cylinder_volume(4, 0)", "0.0")], ["geometry", "rounding"], imports=["import math"]),
    problem("1.19", "impact_speed", "Free-Fall Speed", "Calculate impact speed for an object dropped from rest.", "Ignoring air resistance, final speed follows v = sqrt(2*g*d), where g is gravitational acceleration.", "Use g = 9.8 m/s^2 by default and require non-negative distance.", [arg("distance", "float", "Falling distance in metres."), arg("gravity", "float", "Gravitational acceleration in m/s^2.", "9.8")], "float", "Impact speed in metres per second.", "impact_speed(20)", "approximately 19.799", [case("twenty metres", "impact_speed(20)", "19.79898987322333", True), case("zero distance", "impact_speed(0)", "0.0", True), case("custom gravity", "impact_speed(8, 10)", "12.649110640673518", True)], ["physics", "square roots"], imports=["import math"]),
    problem("1.20", "gas_moles", "Ideal Gas Amount", "Calculate the amount of gas using the ideal gas law.", "The ideal gas law is PV = nRT. Pressure is provided in pascals and volume in litres, which must be converted to cubic metres.", "Rearrange to n = P*V/(R*T), use R = 8.314 J/(mol*K), and require positive temperature.", [arg("pressure_pa", "float", "Gas pressure in pascals."), arg("volume_litres", "float", "Gas volume in litres."), arg("temperature_k", "float", "Absolute temperature in kelvin.")], "float", "Amount of gas in moles.", "gas_moles(101325, 22.4, 273.15)", "approximately 0.999", [case("standard conditions", "gas_moles(101325, 22.4, 273.15)", "0.9993767399537038", True), case("scaled volume", "gas_moles(101325, 44.8, 273.15)", "1.9987534799074076", True), case("simple values", "gas_moles(8314, 1, 1)", "1.0", True)], ["physics", "algebra", "unit conversion"], "Advanced"),
    problem("1.21", "triangle_area", "Triangle Area", "Calculate a triangle's area from its base and height.", "A triangle occupies half of the rectangle with the same base and perpendicular height.", "Use area = base * height / 2 with non-negative measurements.", [arg("base", "float", "Triangle base length."), arg("height", "float", "Perpendicular triangle height.")], "float", "Area in square units.", "triangle_area(10, 5)", "25.0", [case("sample triangle", "triangle_area(10, 5)", "25.0"), case("unit triangle", "triangle_area(1, 1)", "0.5"), case("zero height", "triangle_area(8, 0)", "0.0")], ["geometry", "arithmetic"]),
    problem("1.22", "heron_area", "Triangle Area from Three Sides", "Calculate a triangle's area with Heron's formula.", "When all three side lengths are known, let s be half their sum and calculate sqrt(s*(s-a)*(s-b)*(s-c)).", "The supplied sides form a valid non-degenerate triangle.", [arg("a", "float", "First side length."), arg("b", "float", "Second side length."), arg("c", "float", "Third side length.")], "float", "Triangle area in square units.", "heron_area(3, 4, 5)", "6.0", [case("right triangle", "heron_area(3, 4, 5)", "6.0", True), case("equilateral", "heron_area(2, 2, 2)", "1.7320508075688772", True), case("larger triangle", "heron_area(5, 5, 6)", "12.0", True)], ["geometry", "Heron's formula", "square roots"], "Intermediate", imports=["import math"]),
    problem("1.23", "regular_polygon_area", "Regular Polygon Area", "Calculate the area of a regular polygon.", "A regular polygon has n equal sides of length s and area n*s^2 / (4*tan(pi/n)).", "Use math.pi and math.tan. n is at least 3 and side_length is positive.", [arg("sides", "int", "Number of equal polygon sides."), arg("side_length", "float", "Length of each side.")], "float", "Polygon area in square units.", "regular_polygon_area(4, 2)", "4.0", [case("square", "regular_polygon_area(4, 2)", "4.000000000000001", True), case("equilateral triangle", "regular_polygon_area(3, 2)", "1.7320508075688776", True), case("regular hexagon", "regular_polygon_area(6, 1)", "2.598076211353316", True)], ["geometry", "trigonometry"], "Intermediate", imports=["import math"]),
    problem("1.24", "duration_seconds", "Duration to Seconds", "Convert a duration into a total number of seconds.", "Larger time units can be converted using 24 hours per day, 60 minutes per hour, and 60 seconds per minute.", "All components are non-negative integers.", [arg("days", "int", "Whole days."), arg("hours", "int", "Additional hours."), arg("minutes", "int", "Additional minutes."), arg("seconds", "int", "Additional seconds.")], "int", "Total duration in seconds.", "duration_seconds(1, 2, 3, 4)", "93784", [case("mixed duration", "duration_seconds(1, 2, 3, 4)", "93784"), case("one hour", "duration_seconds(0, 1, 0, 0)", "3600"), case("zero", "duration_seconds(0, 0, 0, 0)", "0")], ["time", "unit conversion"]),
    problem("1.25", "split_seconds", "Seconds to Duration", "Split a number of seconds into days, hours, minutes, and seconds.", "Use integer division and remainder, taking the largest time unit first.", "total_seconds is non-negative. Hours, minutes, and seconds in the result must be within their normal ranges.", [arg("total_seconds", "int", "Non-negative duration in seconds.")], "tuple[int, int, int, int]", "Days, hours, minutes, and seconds.", "split_seconds(93784)", "(1, 2, 3, 4)", [case("mixed duration", "split_seconds(93784)", "(1, 2, 3, 4)"), case("one minute", "split_seconds(60)", "(0, 0, 1, 0)"), case("zero", "split_seconds(0)", "(0, 0, 0, 0)")], ["time", "integer division", "remainder"]),
    problem("1.26", "format_unix_time", "Format a Unix Timestamp", "Format an absolute Unix timestamp as local date and time text.", "Unix timestamps count seconds from 1970-01-01 00:00:00 UTC. Accepting the timestamp as an argument keeps the function deterministic and testable.", "Use datetime.fromtimestamp with timezone.utc and return ISO-like YYYY-MM-DD HH:MM:SS UTC text.", [arg("timestamp", "int | float", "Seconds since the Unix epoch.")], "str", "UTC date and time in YYYY-MM-DD HH:MM:SS UTC format.", "format_unix_time(0)", "'1970-01-01 00:00:00 UTC'", [case("epoch", "format_unix_time(0)", "'1970-01-01 00:00:00 UTC'"), case("one day later", "format_unix_time(86400)", "'1970-01-02 00:00:00 UTC'"), case("known date", "format_unix_time(946684800)", "'2000-01-01 00:00:00 UTC'")], ["datetime", "timestamps", "formatting"], "Intermediate", imports=["from datetime import datetime, timezone"]),
    problem("1.27", "body_mass_index", "Body Mass Index", "Calculate body mass index from metric measurements.", "BMI is mass in kilograms divided by height in metres squared.", "height_m must be positive. Return the raw numeric BMI without classifying it.", [arg("weight_kg", "float", "Body mass in kilograms."), arg("height_m", "float", "Height in metres.")], "float", "Body mass index in kg/m^2.", "body_mass_index(70, 1.75)", "approximately 22.857", [case("sample adult", "body_mass_index(70, 1.75)", "22.857142857142858", True), case("unit values", "body_mass_index(1, 1)", "1.0", True), case("different height", "body_mass_index(80, 2)", "20.0", True)], ["health calculation", "division", "powers"]),
    problem("1.28", "wind_chill", "Wind Chill Index", "Calculate the Canadian wind chill index.", "The Canadian formula is 13.12 + 0.6215*T - 11.37*V^0.16 + 0.3965*T*V^0.16, with T in Celsius and V in km/h.", "The formula is intended for temperatures at or below 10 C and wind speeds above 4.8 km/h. Round to the nearest integer.", [arg("temperature_c", "float", "Air temperature in degrees Celsius."), arg("wind_kph", "float", "Wind speed in kilometres per hour.")], "int", "Rounded wind chill index.", "wind_chill(-10, 20)", "-18", [case("cold day", "wind_chill(-10, 20)", "-18"), case("milder day", "wind_chill(0, 10)", "-4"), case("very cold", "wind_chill(-20, 30)", "-33")], ["weather", "formula", "rounding"], "Intermediate"),
    problem("1.29", "temperature_conversions", "Temperature Converter", "Convert Celsius to Fahrenheit and kelvin.", "Fahrenheit is C*9/5+32 and kelvin is C+273.15.", "Return both conversions without rounding.", [arg("celsius", "float", "Temperature in degrees Celsius.")], "tuple[float, float]", "Fahrenheit temperature followed by kelvin temperature.", "temperature_conversions(0)", "(32.0, 273.15)", [case("freezing", "temperature_conversions(0)", "(32.0, 273.15)"), case("boiling", "temperature_conversions(100)", "(212.0, 373.15)"), case("equal scales", "temperature_conversions(-40)", "(-40.0, 233.14999999999998)")], ["temperature", "unit conversion"]),
    problem("1.30", "pressure_conversions", "Pressure Unit Converter", "Convert kilopascals to common pressure units.", "One kilopascal equals approximately 0.145037738 psi, 7.50061683 mmHg, and 0.00986923267 atmospheres.", "Multiply the supplied kPa value by each conversion factor.", [arg("kilopascals", "float", "Pressure measured in kilopascals.")], "tuple[float, float, float]", "Equivalent psi, mmHg, and atmospheres.", "pressure_conversions(101.325)", "approximately (14.696, 760, 1)", [case("standard atmosphere psi", "pressure_conversions(101.325)[0]", "14.69594880135", True), case("standard atmosphere mmHg", "pressure_conversions(101.325)[1]", "760.00000029975", True), case("zero", "pressure_conversions(0)", "(0.0, 0.0, 0.0)")], ["pressure", "unit conversion"]),
    problem("1.31", "digit_sum", "Sum an Integer's Digits", "Add the decimal digits of a non-negative integer.", "Integer division and remainder can isolate digits without converting the value to text.", "Support any non-negative integer, including zero.", [arg("number", "int", "Non-negative integer whose digits should be added.")], "int", "Sum of the decimal digits.", "digit_sum(3141)", "9", [case("four digits", "digit_sum(3141)", "9"), case("contains zeros", "digit_sum(1002)", "3"), case("zero", "digit_sum(0)", "0")], ["digits", "integer division", "remainder"]),
    problem("1.32", "sort_three", "Sort Three Values", "Order three integers from smallest to largest.", "Three values can be ordered using min, max, and their total without a general sorting algorithm.", "Return a tuple in ascending order and preserve duplicate values.", [arg("a", "int", "First integer."), arg("b", "int", "Second integer."), arg("c", "int", "Third integer.")], "tuple[int, int, int]", "The three values in nondecreasing order.", "sort_three(9, 2, 5)", "(2, 5, 9)", [case("mixed order", "sort_three(9, 2, 5)", "(2, 5, 9)"), case("duplicates", "sort_three(4, 4, 1)", "(1, 4, 4)"), case("negative values", "sort_three(-1, -5, 3)", "(-5, -1, 3)")], ["min", "max", "tuples"]),
    problem("1.33", "bread_order", "Day-Old Bread Discount", "Calculate pricing for a day-old bread order.", "A fresh loaf costs $3.49 and day-old bread is discounted by 60 percent.", "Return the regular price, discount amount, and final total, each rounded to two decimal places.", [arg("loaves", "int", "Non-negative number of day-old loaves."), arg("price", "float", "Regular price per loaf.", "3.49"), arg("discount_rate", "float", "Discount rate as a decimal.", "0.60")], "tuple[float, float, float]", "Regular total, discount, and final price.", "bread_order(3)", "(10.47, 6.28, 4.19)", [case("three loaves", "bread_order(3)", "(10.47, 6.28, 4.19)"), case("one loaf", "bread_order(1)", "(3.49, 2.09, 1.4)"), case("no loaves", "bread_order(0)", "(0.0, 0.0, 0.0)")], ["currency", "discounts", "rounding"]),
]


CHAPTERS = {
    "basics": {"id": "basics", "category": "Basics", "file": "basics.json", "specs": BASICS},
}


def main() -> None:
    core_path = ROOT / "problems" / "problems.json"
    core = json.loads(core_path.read_text())
    for chapter in CHAPTERS.values():
        generated = [build_problem(chapter, spec) for spec in chapter["specs"]]
        for item in generated:
            for starter_file in item["starterFiles"]:
                ast.parse(starter_file["content"])
            for test in item["tests"]:
                ast.parse(test["code"])
        (ROOT / "problems" / chapter["file"]).write_text(
            json.dumps({"version": 1, "problems": generated}, indent=2, ensure_ascii=False) + "\n"
        )
        section = next(value for value in core["sections"] if value["id"] == chapter["id"])
        existing = {entry.get("number"): entry for entry in section["problems"] if entry.get("id")}
        references = []
        for item in generated:
            references.append({"number": item["number"], "title": item["title"], "id": item["id"]})
        if chapter["id"] == "basics":
            references = section["problems"][:4] + references
        section["problems"] = references
    core_path.write_text(json.dumps(core, indent=2, ensure_ascii=False) + "\n")
    from add_advanced_boundary_tests import main as add_advanced_boundary_tests
    add_advanced_boundary_tests()


if __name__ == "__main__":
    main()

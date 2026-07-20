#!/usr/bin/env python3
"""Add structured teaching docstrings to every workbook Python starter."""

from __future__ import annotations

import ast
import json
import re
import textwrap
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOGS = [
    ROOT / "problems" / name
    for name in ("problems.json", "dictionaries.json", "files.json")
]

ARGUMENT_DESCRIPTIONS = {
    "a": "The first integer in the calculation.",
    "b": "The second integer in the calculation.",
    "card": "A Bingo-card dictionary with B, I, N, G, and O columns.",
    "cards_each": "The number of cards that each hand must receive.",
    "code": "The code or encoded text to validate or translate.",
    "coin_count": "The exact number of coins that may be used.",
    "count": "The requested number of items; see the rules above for valid values.",
    "data": "The input sequence or structured data to process.",
    "deck": "The mutable list of card codes used by the operation.",
    "denominations": "The available coin values, expressed in cents.",
    "dictionary_path": "Path to the dictionary file containing recognized words.",
    "directory": "Path to the directory containing the required input files.",
    "elements": "The parsed collection of chemical-element records.",
    "encoded": "The run-length encoded sequence to decode.",
    "end_year": "The final year to include, inclusive.",
    "expression": "The mathematical expression to split into tokens.",
    "first": "The first word, phrase, or value being compared.",
    "games": "The positive number of complete simulations to perform.",
    "guess": "The current approximation used by the recursive calculation.",
    "hand_count": "The number of separate hands to deal.",
    "input_path": "Path to the existing source file that will be read.",
    "items": "The ordered list of items to format.",
    "larger": "The list that may contain the candidate sublist.",
    "limit": "The inclusive upper bound of the requested calculation.",
    "lines": "The input lines to parse in their original order.",
    "mapping": "The dictionary whose key-value pairs will be searched.",
    "maximum": "The inclusive upper bound of the interval.",
    "message": "The message to encode, preserving its original order.",
    "minimum": "The inclusive lower bound of the interval.",
    "n": "The integer used by the calculation; see the rules above for its valid range.",
    "number": "The numeric value to convert or describe.",
    "output_path": "Path where the newly produced file must be written.",
    "path": "Path to the input file that will be opened and processed.",
    "paths": "The ordered collection of file paths to process.",
    "points": "A list of (x, y) coordinate pairs.",
    "query": "The name, symbol, or number to locate.",
    "rolls": "The non-negative number of dice trials to simulate.",
    "second": "The second word, phrase, or value being compared.",
    "seed": "Optional random seed used to make results reproducible.",
    "sensitive_path": "Path to the file listing words that must be redacted.",
    "smaller": "The candidate contiguous sublist.",
    "source": "The original string being transformed or compared.",
    "start": "The starting element for the search or sequence.",
    "start_year": "The first year to include, inclusive.",
    "symbols": "The available chemical symbols used to spell the word.",
    "target": "The target value or destination string used by the operation.",
    "text": "The source text to transform or analyze.",
    "text_path": "Path to the text file whose words will be checked.",
    "tokens": "The expression tokens in their current order.",
    "total_cents": "The exact monetary total, expressed in cents.",
    "value": "The value to classify, translate, or convert.",
    "values": "The input values in their original order.",
    "width": "The maximum permitted output line width.",
    "word": "The word to analyze or represent with symbols.",
    "word_path": "Path to the file containing candidate words.",
    "year": "The four-digit year whose records should be examined.",
}

# Caller-facing summary, return annotation, and return-value description for every
# function currently shipped in the workbook. Keeping this explicit prevents vague
# documentation for the more complex exercises and makes this file an audit list.
FUNCTION_CONTRACTS = {
    "reverse_lookup": ("Return every dictionary key associated with a target value.", "list[object]", "A new list of matching keys in dictionary iteration order."),
    "dice_totals": ("Simulate repeated rolls of two six-sided dice.", "dict[int, int]", "Counts for every possible total from 2 through 12."),
    "keypad_presses": ("Encode a message as presses on a multi-tap numeric keypad.", "str", "The concatenated sequence of keypad digits."),
    "to_morse": ("Encode the supported letters and digits in a message as Morse code.", "str", "Space-separated Morse symbols for each supported character."),
    "describe_postal_code": ("Identify the region and address type represented by a Canadian postal code.", "tuple[str, str]", "A pair containing the region name and either 'urban' or 'rural'."),
    "number_to_words": ("Convert an integer from 0 through 999 to English words.", "str", "The lowercase English representation of number."),
    "unique_character_count": ("Count the distinct characters in a string.", "int", "The number of unique, case-sensitive characters in text."),
    "are_anagrams": ("Determine whether two strings contain identical character frequencies.", "bool", "True when the strings are exact character anagrams; otherwise False."),
    "are_phrase_anagrams": ("Determine whether two phrases are anagrams after normalization.", "bool", "True when the phrases contain the same letters after normalization."),
    "word_score": ("Calculate the word-tile score of the letters in text.", "int", "The sum of the configured point values for supported letters."),
    "create_bingo_card": ("Create a reproducible five-column Bingo card.", "dict[str, list[int]]", "A BINGO-keyed dictionary containing five valid numbers per column."),
    "is_winning_card": ("Check whether a marked Bingo card contains a winning line.", "bool", "True for a complete horizontal, vertical, or diagonal line of zeros."),
    "simulate_bingo": ("Simulate Bingo games and summarize the calls required to win.", "tuple[int, int, float]", "The minimum, maximum, and mean call counts across all games."),
    "remove_outliers": ("Return a copy of a numeric list without its most extreme values.", "list[int | float]", "A new list with the n smallest and n largest values removed."),
    "proper_divisors": ("Find every positive proper divisor of an integer.", "list[int]", "The proper divisors of n in increasing order."),
    "is_perfect": ("Determine whether an integer equals the sum of its proper divisors.", "bool", "True when n is a perfect number; otherwise False."),
    "extract_words": ("Split text into words while removing punctuation from word boundaries.", "list[str]", "The cleaned words in their original order."),
    "classify_by_average": ("Group numeric values according to their relationship to the mean.", "tuple[float, list[int | float], list[int | float], list[int | float]]", "The mean followed by below-average, equal-to-average, and above-average lists."),
    "format_items": ("Format a sequence of strings as a natural-language list.", "str", "A comma-separated phrase with 'and' before the final item."),
    "lottery_ticket": ("Generate a sorted lottery ticket containing six unique numbers.", "list[int]", "Six distinct integers from 1 through 49 in ascending order."),
    "to_pig_latin": ("Translate space-separated English words into Pig Latin.", "str", "The translated words joined in their original order."),
    "best_fit": ("Calculate the least-squares line for a collection of points.", "tuple[float, float]", "The slope and y-intercept of the best-fit line."),
    "create_deck": ("Create a standard 52-card deck using two-character card codes.", "list[str]", "A new list containing each valid card code exactly once."),
    "shuffle_deck": ("Randomize a deck in place using swaps.", "None", "The supplied deck is modified in place."),
    "deal_hands": ("Deal cards from a deck into hands in round-robin order.", "list[list[str]]", "A list of hands; dealt cards are removed from deck."),
    "is_monotonic": ("Check whether a sequence is entirely nondecreasing or nonincreasing.", "bool", "True when values are monotonic in either direction."),
    "count_in_range": ("Count values that fall inside an inclusive numeric interval.", "int", "The number of values between minimum and maximum, inclusive."),
    "tokenize": ("Split a mathematical expression into numbers, operators, and parentheses.", "list[str]", "Expression tokens in their original order."),
    "infix_to_postfix": ("Convert an infix token sequence to postfix notation.", "list[str]", "A new list containing the equivalent postfix tokens."),
    "evaluate_postfix": ("Evaluate a valid postfix arithmetic expression.", "float", "The numeric result of evaluating the token sequence."),
    "contains_sublist": ("Check whether one list occurs contiguously inside another.", "bool", "True when smaller is a contiguous sublist of larger."),
    "all_sublists": ("Generate every contiguous sublist of a list.", "list[list[object]]", "All contiguous sublists, including the empty list."),
    "primes_up_to": ("Generate prime numbers with the Sieve of Eratosthenes.", "list[int]", "Every prime integer from 2 through limit."),
    "recursive_sum": ("Recursively total a list of numbers.", "int | float", "The arithmetic sum of values, or zero for an empty list."),
    "recursive_gcd": ("Compute the greatest common divisor with recursive Euclid's algorithm.", "int", "The non-negative greatest common divisor of a and b."),
    "to_binary": ("Recursively convert a non-negative integer to binary text.", "str", "The base-2 representation of n without a prefix."),
    "is_recursive_palindrome": ("Recursively check whether text reads the same in both directions.", "bool", "True when text is a case-sensitive palindrome."),
    "recursive_sqrt": ("Approximate a non-negative square root with recursive Newton iteration.", "float", "An approximation of the principal square root of n."),
    "edit_distance": ("Compute the minimum edit distance between two strings.", "int", "The fewest single-character insertions, deletions, or substitutions required."),
    "can_make_change": ("Check whether an exact value can be formed with an exact coin count.", "bool", "True when the requested total and coin count can both be satisfied."),
    "spell_with_symbols": ("Spell a word by recursively combining chemical-element symbols.", "tuple[bool, str]", "A success flag and the symbol spelling, or False and an empty string."),
    "longest_chain": ("Find the longest valid duplicate-free chain of element names.", "list[str]", "A longest chain beginning with start, or an empty list when start is unavailable."),
    "decode_runs": ("Recursively expand run-length encoded values.", "list[object]", "A new list containing each value repeated by its encoded count."),
    "encode_runs": ("Recursively run-length encode adjacent equal values.", "list[object]", "A flat list alternating each run value with its count."),
    "read_head": ("Read a requested number of lines from the beginning of a text file.", "list[str]", "The first available lines without trailing newline characters."),
    "read_tail": ("Read a requested number of lines from the end of a text file.", "list[str]", "The final available lines without trailing newline characters."),
    "concatenate_files": ("Combine readable text files while recording failed paths.", "tuple[str, list[str]]", "The combined text and an ordered list of paths that could not be read."),
    "number_file": ("Copy a text file while prefixing each line with its line number.", "int", "The number of lines written to output_path."),
    "longest_words": ("Find the longest whitespace-separated tokens in a text file.", "tuple[int, list[str]]", "The maximum token length and every longest token in encounter order."),
    "letter_frequencies": ("Count ASCII letter occurrences in a text file.", "dict[str, int]", "Counts for every lowercase letter from a through z."),
    "most_common_words": ("Find the most frequent normalized words in a text file.", "tuple[int, list[str]]", "The highest frequency and the alphabetically sorted words tied at that frequency."),
    "sum_valid_numbers": ("Accumulate valid numeric strings while recording invalid input.", "tuple[list[float], list[str]]", "Running totals and rejected nonblank input lines."),
    "convert_grade": ("Convert between a supported letter grade and numeric grade points.", "str | float", "A letter grade for numeric input, or grade points for letter input."),
    "remove_comments": ("Copy Python-like source text while removing comment fragments.", "int", "The number of source lines processed and written."),
    "make_password": ("Create a random password from two compatible dictionary words.", "str", "Two distinct capitalized words concatenated into an 8-to-10-character password."),
    "load_elements": ("Load chemical-element records from a CSV text file.", "list[tuple[int, str, str]]", "Parsed atomic-number, symbol, and name tuples in file order."),
    "lookup_element": ("Look up a chemical element by number, symbol, or name.", "tuple[int, str, str]", "The matching atomic-number, symbol, and name tuple."),
    "letter_coverage": ("Measure how often each letter appears across words in a file.", "tuple[dict[str, float], list[str]]", "Per-letter word proportions and the alphabetically sorted least-used letters."),
    "annual_top_names": ("Collect the most popular boy and girl names from annual data files.", "tuple[list[str], list[str]]", "Sorted unique lists of annual top boy names and girl names."),
    "gender_neutral_names": ("Find names present in both annual boy and girl name files.", "list[str]", "Shared names for year in alphabetical order."),
    "most_popular_names": ("Find names with the greatest cumulative counts across a year range.", "tuple[list[str], list[str]]", "Alphabetically sorted boy-name and girl-name winners, including ties."),
    "distinct_names": ("Collect every distinct boy and girl name in an archive.", "tuple[list[str], list[str]]", "Alphabetically sorted unique boy-name and girl-name lists."),
    "misspelled_words": ("Find document words that are absent from a dictionary file.", "list[str]", "Unique misspellings in lowercase first-seen order."),
    "repeated_words": ("Locate consecutive repeated words in a text file.", "list[tuple[int, str]]", "The line number and normalized word for each repeated occurrence."),
    "redact_file": ("Write a copy of a text file with sensitive terms replaced by asterisks.", "int", "The total number of case-insensitive replacements written."),
    "missing_function_comments": ("Find top-level functions without an immediately preceding comment.", "tuple[list[tuple[str, int, str]], list[str]]", "Documentation findings and paths that could not be read."),
    "reflow_file": ("Reflow paragraphs from a text file to a target line width.", "str", "The reformatted text without an extra trailing newline."),
    "six_vowel_words": ("Find words whose vowels are exactly a, e, i, o, u, and y in order.", "list[str]", "Matching words in their original file order."),
}

ARGUMENT_TYPES = {
    "a": "int", "b": "int", "card": "dict[str, list[int]]", "cards_each": "int",
    "code": "str", "coin_count": "int", "count": "int", "data": "str | list[object]",
    "deck": "list[str]", "denominations": "tuple[int, ...]", "dictionary_path": "str",
    "directory": "str", "elements": "list[tuple[int, str, str]]", "encoded": "list[object]",
    "end_year": "int", "expression": "str", "first": "str", "games": "int",
    "guess": "float", "hand_count": "int", "input_path": "str", "items": "list[str]",
    "larger": "list[object]", "limit": "int", "lines": "list[str]",
    "mapping": "dict[object, object]", "maximum": "float", "message": "str",
    "minimum": "float", "n": "int", "number": "int", "output_path": "str",
    "path": "str", "paths": "list[str]", "points": "list[tuple[float, float]]",
    "query": "str | int", "rolls": "int", "second": "str", "seed": "int | None",
    "sensitive_path": "str", "smaller": "list[object]", "source": "str", "start": "str",
    "start_year": "int", "symbols": "list[str]", "target": "object", "text": "str",
    "text_path": "str", "tokens": "list[str]", "total_cents": "int", "value": "str",
    "values": "list[int | float]", "width": "int", "word": "str", "word_path": "str",
    "year": "int",
}

ARGUMENT_TYPE_OVERRIDES = {
    ("edit_distance", "target"): "str",
    ("reverse_lookup", "target"): "object",
    ("longest_chain", "elements"): "list[str]",
    ("all_sublists", "values"): "list[object]",
    ("contains_sublist", "larger"): "list[object]",
    ("contains_sublist", "smaller"): "list[object]",
    ("decode_runs", "encoded"): "list[object]",
    ("recursive_sqrt", "n"): "float",
}

ARGUMENT_DESCRIPTION_OVERRIDES = {
    ("reverse_lookup", "target"): "The value that dictionary entries must equal.",
    ("keypad_presses", "message"): "The text to encode with the supported keypad symbols.",
    ("to_morse", "message"): "The text whose supported letters and digits should be encoded.",
    ("describe_postal_code", "code"): "A six-character Canadian postal code, with an optional space.",
    ("number_to_words", "number"): "An integer from 0 through 999.",
    ("unique_character_count", "text"): "The case-sensitive string whose characters should be counted.",
    ("word_score", "text"): "Text containing the letters to score; unsupported characters are ignored.",
    ("extract_words", "text"): "The text to split and clean at word boundaries.",
    ("to_pig_latin", "text"): "Space-separated text to translate while preserving word order.",
    ("is_recursive_palindrome", "text"): "The case-sensitive string to examine recursively.",
    ("are_anagrams", "first"): "The first case-sensitive string to compare.",
    ("are_anagrams", "second"): "The second case-sensitive string to compare.",
    ("are_phrase_anagrams", "first"): "The first phrase; case and nonletters are ignored.",
    ("are_phrase_anagrams", "second"): "The second phrase; case and nonletters are ignored.",
    ("remove_outliers", "values"): "The numeric values to copy and trim without mutation.",
    ("classify_by_average", "values"): "The non-empty numeric values to classify in original order.",
    ("format_items", "items"): "The strings to join in natural-language order.",
    ("best_fit", "points"): "At least two (x, y) pairs whose x-values are not all equal.",
    ("deal_hands", "deck"): "The card list to consume from the front while dealing.",
    ("is_monotonic", "values"): "The numeric sequence to check in both ordering directions.",
    ("count_in_range", "values"): "The numeric values to compare with the interval bounds.",
    ("tokenize", "expression"): "An infix arithmetic expression containing supported syntax.",
    ("infix_to_postfix", "tokens"): "Valid infix tokens in source order.",
    ("evaluate_postfix", "tokens"): "Valid postfix number and operator tokens.",
    ("edit_distance", "target"): "The destination string that source should become.",
    ("edit_distance", "source"): "The original string to transform.",
    ("recursive_sum", "values"): "The numeric values to total recursively.",
    ("recursive_gcd", "a"): "The first integer in Euclid's algorithm.",
    ("recursive_gcd", "b"): "The second integer in Euclid's algorithm.",
    ("read_head", "count"): "The maximum number of leading lines to return.",
    ("read_tail", "count"): "The maximum number of trailing lines to return.",
    ("remove_outliers", "n"): "The number of values to remove from each extreme.",
    ("proper_divisors", "n"): "The positive integer whose divisors are required.",
    ("is_perfect", "n"): "The integer to test for perfection.",
    ("to_binary", "n"): "The non-negative integer to convert.",
    ("recursive_sqrt", "n"): "The non-negative value whose square root is required.",
    ("recursive_sqrt", "guess"): "The current positive approximation; callers normally omit it.",
    ("can_make_change", "denominations"): "Positive coin values available to the recursive search.",
    ("spell_with_symbols", "symbols"): "Allowed one-, two-, or three-letter element symbols.",
    ("longest_chain", "start"): "The element name that must begin the returned chain.",
    ("convert_grade", "value"): "A supported letter grade or numeric point value represented as text.",
    ("sum_valid_numbers", "lines"): "Numeric text entries ending at the first blank string.",
    ("concatenate_files", "paths"): "Text-file paths to read and combine in order.",
    ("number_file", "input_path"): "Path to the source text whose lines should be numbered.",
    ("number_file", "output_path"): "Path where the numbered copy should be written.",
    ("make_password", "word_path"): "Path to a file containing one candidate word per line.",
    ("load_elements", "path"): "Path to CSV rows containing atomic number, symbol, and name.",
    ("letter_coverage", "path"): "Path to a file containing one candidate word per nonblank line.",
    ("annual_top_names", "directory"): "Directory containing YEAR_boys.txt and YEAR_girls.txt files.",
    ("gender_neutral_names", "directory"): "Directory containing the two annual name files.",
    ("most_popular_names", "directory"): "Directory containing annual boy and girl name files.",
    ("distinct_names", "directory"): "Directory containing the annual name archive.",
    ("misspelled_words", "text_path"): "Path to the document whose words should be checked.",
    ("misspelled_words", "dictionary_path"): "Path to a file containing recognized words.",
    ("redact_file", "input_path"): "Path to the source text that may contain sensitive terms.",
    ("redact_file", "sensitive_path"): "Path to one sensitive term per nonblank line.",
    ("redact_file", "output_path"): "Path where the redacted copy should be written.",
    ("missing_function_comments", "paths"): "Python-source paths to inspect in the supplied order.",
    ("reflow_file", "width"): "Maximum output width, except for an individual longer word.",
    ("lookup_element", "elements"): "Element records returned by load_elements.",
    ("longest_chain", "elements"): "The available element names, matched case-insensitively.",
    ("all_sublists", "values"): "The source list whose contiguous sublists are required.",
    ("encode_runs", "data"): "A string or list whose adjacent runs should be encoded.",
    ("decode_runs", "encoded"): "A flat list alternating values with positive repetition counts.",
}

FUNCTION_RAISES = {
    "dice_totals": [("ValueError", "If rolls is negative.")],
    "describe_postal_code": [("ValueError", "If code is malformed or begins with an unsupported letter.")],
    "number_to_words": [("ValueError", "If number is not an integer from 0 through 999.")],
    "simulate_bingo": [("ValueError", "If games is not a positive integer.")],
    "remove_outliers": [("ValueError", "If n is negative or values contains fewer than 2 * n items.")],
    "deal_hands": [("ValueError", "If deck does not contain enough cards for all requested hands.")],
    "read_head": [("FileNotFoundError", "If path does not exist."), ("ValueError", "If count is negative.")],
    "read_tail": [("ValueError", "If count is negative.")],
    "convert_grade": [("ValueError", "If value is not a supported letter grade or point value.")],
    "make_password": [("ValueError", "If the word file contains no valid pair.")],
    "lookup_element": [("LookupError", "If no element matches query.")],
    "gender_neutral_names": [("FileNotFoundError", "If either name file for year is unavailable.")],
    "most_popular_names": [("ValueError", "If start_year is later than end_year."), ("FileNotFoundError", "If a required annual name file is unavailable.")],
}

PROGRAM_CONTRACTS = {
    "basics-mailing-address": ("Print a complete mailing address in envelope format.", "No input.", "At least three non-empty address lines."),
    "basics-hello": ("Read a person's name and print a personalized greeting.", "One name from standard input.", "A friendly greeting containing the supplied name."),
    "basics-area-room": ("Calculate the area of a rectangular room in square metres.", "The room width followed by its length, both as decimal numbers.", "The calculated area labelled in square metres."),
    "basics-area-field": ("Convert a rectangular field's area from square feet to acres.", "The field length followed by its width, both measured in feet.", "The calculated area in acres using 43,560 square feet per acre."),
    "lists-sorted-order": ("Read integers until zero and print the entered values in ascending order.", "One integer per line, terminated by the sentinel 0.", "Each non-sentinel value on its own line from smallest to largest."),
    "lists-reverse-order": ("Read integers until zero and print them in reverse entry order.", "One integer per line, terminated by the sentinel 0.", "Each non-sentinel value on its own line, last entered first."),
    "lists-avoiding-duplicates": ("Print each entered word once in first-seen order.", "One word per line, terminated by a blank line.", "Each distinct word on its own line without duplicates."),
    "lists-group-by-sign": ("Group entered integers as negative, zero, and positive values.", "One integer per line, terminated by a blank line.", "Negative values, then zeros, then positive values, preserving order within each group."),
}

PROGRAM_VARIABLE_TYPES = {
    "name": "str",
    "width": "float",
    "length": "float",
    "values": "list[int]",
    "words": "list[str]",
    "negatives": "list[int]",
    "zeros": "list[int]",
    "positives": "list[int]",
}


def wrap_doc_line(prefix: str, text: str, indent: str, width: int = 92) -> list[str]:
    subsequent = " " * len(prefix)
    wrapped = textwrap.wrap(
        text,
        width=max(30, width - len(indent)),
        initial_indent=prefix,
        subsequent_indent=subsequent,
        break_long_words=False,
        break_on_hyphens=False,
    )
    return [indent + line.rstrip() for line in wrapped] or [indent + prefix.rstrip()]


def function_docstring(problem: dict, node: ast.FunctionDef) -> list[str]:
    indent = " " * (node.col_offset + 4)
    summary, return_type, return_text = FUNCTION_CONTRACTS[node.name]
    lines = [indent + '"""' + summary]
    args = [argument.arg for argument in node.args.args]
    if args:
        lines += [indent, indent + "Args:"]
        for name in args:
            description = ARGUMENT_DESCRIPTION_OVERRIDES.get(
                (node.name, name),
                ARGUMENT_DESCRIPTIONS.get(
                    name, f"The {name.replace('_', ' ')} value required by this operation."
                ),
            )
            argument_type = ARGUMENT_TYPE_OVERRIDES.get(
                (node.name, name), ARGUMENT_TYPES[name]
            )
            lines += wrap_doc_line(f"{name} ({argument_type}): ", description, indent + "    ")
    lines += [indent, indent + "Returns:"]
    lines += wrap_doc_line(f"{return_type}: ", return_text, indent + "    ")
    raises = FUNCTION_RAISES.get(node.name, [])
    if raises:
        lines += [indent, indent + "Raises:"]
        for exception, description in raises:
            lines += wrap_doc_line(f"{exception}: ", description, indent + "    ")
    lines.append(indent + '"""')
    return lines


def program_docstring(problem: dict) -> list[str]:
    summary, input_text, output_text = PROGRAM_CONTRACTS[problem["id"]]
    return [
        '"""' + summary,
        "",
        "Input:",
        f"    {input_text}",
        "",
        "Output:",
        f"    {output_text}",
        '"""',
        "",
    ]


def annotated_signature(node: ast.FunctionDef) -> str:
    """Build a typed signature while retaining each starter's default values."""
    arguments = node.args.args
    defaults = [None] * (len(arguments) - len(node.args.defaults)) + list(node.args.defaults)
    rendered = []
    for argument, default in zip(arguments, defaults):
        argument_type = ARGUMENT_TYPE_OVERRIDES.get(
            (node.name, argument.arg), ARGUMENT_TYPES[argument.arg]
        )
        item = f"{argument.arg}: {argument_type}"
        if default is not None:
            item += f" = {ast.unparse(default)}"
        rendered.append(item)
    return_type = FUNCTION_CONTRACTS[node.name][1]
    return " " * node.col_offset + f"def {node.name}({', '.join(rendered)}) -> {return_type}:"


def enrich(content: str, problem: dict) -> str:
    tree = ast.parse(content)
    functions = [node for node in tree.body if isinstance(node, ast.FunctionDef)]
    lines = content.rstrip().splitlines()
    if not functions:
        if (
            tree.body
            and isinstance(tree.body[0], ast.Expr)
            and isinstance(tree.body[0].value, ast.Constant)
            and isinstance(tree.body[0].value.value, str)
            and problem["id"] in PROGRAM_CONTRACTS
        ):
            del lines[tree.body[0].lineno - 1 : tree.body[0].end_lineno]
            while lines and not lines[0].strip():
                lines.pop(0)
        for index, line in enumerate(lines):
            match = re.match(r"^(\w+)\s*=\s*(.+)$", line)
            if match and match.group(1) in PROGRAM_VARIABLE_TYPES:
                name, value = match.groups()
                lines[index] = f"{name}: {PROGRAM_VARIABLE_TYPES[name]} = {value}"
        return "\n".join(program_docstring(problem) + lines) + "\n"

    for node in sorted(functions, key=lambda item: item.lineno, reverse=True):
        insertion = node.lineno
        lines[node.lineno - 1] = annotated_signature(node)
        if (
            node.body
            and isinstance(node.body[0], ast.Expr)
            and isinstance(node.body[0].value, ast.Constant)
            and isinstance(node.body[0].value.value, str)
            and node.name in FUNCTION_CONTRACTS
        ):
            del lines[node.body[0].lineno - 1 : node.body[0].end_lineno]
        lines[insertion:insertion] = function_docstring(problem, node)
    return "\n".join(lines) + "\n"


def main() -> None:
    changed = 0
    for catalog_path in CATALOGS:
        catalog = json.loads(catalog_path.read_text())
        catalog_changed = False
        for problem in catalog.get("problems", []):
            for starter in problem.get("starterFiles", []):
                if starter.get("name", "").endswith(".py"):
                    updated = enrich(starter["content"], problem)
                    if updated != starter["content"]:
                        starter["content"] = updated
                        changed += 1
                        catalog_changed = True
                    functions = [
                        node for node in ast.parse(updated).body if isinstance(node, ast.FunctionDef)
                    ]
                    if functions:
                        signature = "\n\n".join(annotated_signature(node).strip() for node in functions)
                        if problem.get("signature") != signature:
                            problem["signature"] = signature
                            catalog_changed = True
        if catalog_changed:
            catalog_path.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")
    print(f"Updated {changed} Python starter files.")


if __name__ == "__main__":
    main()

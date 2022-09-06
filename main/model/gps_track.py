import logging

from datetime import datetime
from dataclasses import dataclass
from typing import List
from enum import Enum, auto

import xml.etree.ElementTree as ET


@dataclass
class Coordinate:
    longitude: float
    latitude: float
    altitude: float = 0


@dataclass
class GpsFix:
    timestamp: datetime
    coordinate: Coordinate


class GpsTrackSection:
    """ Order of fixes is guaranteed to be time asc """
    def __init__(self, name: str, gps_fixes: List[GpsFix] = None):
        self.name = name
        self.gps_fixes = sorted(gps_fixes if gps_fixes is not None else [], key = lambda f: f.timestamp)

    def add_gps_fix(self, timestamp: datetime, coordinate: Coordinate):
        self.gps_fixes.append(GpsFix(timestamp, coordinate))


class GpsTrack:
    def __init__(self, name: str, sections: List[GpsTrackSection] = None):
        self.name = name
        self.sections = sections.copy() if sections is not None else []

    def add_section(self, section: GpsTrackSection):
        self.sections.append(section)


class GpxTrackParser:
    class ParsingState(Enum):
        NONE = auto()
        TRACK = auto()
        SEGMENT = auto()
        POINT = auto()

    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def can_parse(self, extension: str) -> bool:
        return extension.casefold() == ".gpx"
    
    def parse(self, path: str) -> GpsTrack:
        track = GpsTrack("undefined")
        state = GpxTrackParser.ParsingState.NONE
        name = "undefined"
        fixes = []
        current_trkpt = {}
        for event, element in ET.iterparse(path, ["start", "end"]):
            # <trk>
            if state == GpxTrackParser.ParsingState.NONE and event == 'start' and element.tag == "{http://www.topografix.com/GPX/1/1}trk":
                state = GpxTrackParser.ParsingState.TRACK
            # trk/<trkseg>
            if state == GpxTrackParser.ParsingState.TRACK and event == 'start' and element.tag == "{http://www.topografix.com/GPX/1/1}trkseg":
                state = GpxTrackParser.ParsingState.SEGMENT
                fixes = []
            # trk/trkseg/<trkpt>
            if state == GpxTrackParser.ParsingState.SEGMENT and event == 'start' and element.tag == "{http://www.topografix.com/GPX/1/1}trkpt":
                state = GpxTrackParser.ParsingState.POINT
                current_trkpt = {
                    "time": None,
                    "lat": None,
                    "lon": None,
                    "ele": None
                }
            # trk/</name>
            if state == GpxTrackParser.ParsingState.TRACK and event == 'end' and element.tag == "{http://www.topografix.com/GPX/1/1}name":
                name = element.text.strip()
                track.name = name
            # trk/trkseg/trkpt/</ele>
            if state == GpxTrackParser.ParsingState.POINT and event == 'end' and element.tag == "{http://www.topografix.com/GPX/1/1}ele":
                state = GpxTrackParser.ParsingState.POINT
                current_trkpt["ele"] = float(element.text)
            # trk/trkseg/trkpt/</time>
            if state == GpxTrackParser.ParsingState.POINT and event == 'end' and element.tag == "{http://www.topografix.com/GPX/1/1}time":
                state = GpxTrackParser.ParsingState.POINT
                current_trkpt["time"] = datetime.fromisoformat(element.text.replace('Z', '+00:00'))
            # trk/trkseg/</trkpt>
            if state == GpxTrackParser.ParsingState.POINT and event == 'end' and element.tag == "{http://www.topografix.com/GPX/1/1}trkpt":
                state = GpxTrackParser.ParsingState.SEGMENT
                current_trkpt["lat"] = float(element.attrib["lat"])
                current_trkpt["lon"] = float(element.attrib["lon"])
                fixes.append(GpsFix(current_trkpt["time"], Coordinate(current_trkpt["lon"], current_trkpt["lat"], current_trkpt["ele"])))
            # trk/</trkseg>
            if state == GpxTrackParser.ParsingState.SEGMENT and event == 'end' and element.tag == "{http://www.topografix.com/GPX/1/1}trkseg":
                state = GpxTrackParser.ParsingState.TRACK
                track.add_section(GpsTrackSection(f"{name}_{len(track.sections) + 1}", fixes))
            # </trk>
            if state == GpxTrackParser.ParsingState.TRACK and event == 'end' and element.tag == "{http://www.topografix.com/GPX/1/1}trk":
                state = GpxTrackParser.ParsingState.NONE
        return track


class KmlTrackParser:
    class ParsingState(Enum):
        NONE = auto()
        PLACEMARK = auto()
        TIMESPAN = auto()
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def can_parse(self, extension: str) -> bool:
        return extension.casefold() == ".kml"

    def parse(self, path: str) -> GpsTrack:
        track = GpsTrack("undefined")
        state = KmlTrackParser.ParsingState.NONE
        current_placemark = {}
        current_timespan = {}
        for event, element in ET.iterparse(path, ["start", "end"]):
            # </name>
            if state == KmlTrackParser.ParsingState.NONE and event == 'end' and element.tag == "{http://www.opengis.net/kml/2.2}name":
                track.name = element.text.strip()
            # <Placemark>
            if state == KmlTrackParser.ParsingState.NONE and event == 'start' and element.tag == "{http://www.opengis.net/kml/2.2}Placemark":
                state = KmlTrackParser.ParsingState.PLACEMARK
                current_placemark = {
                    "name": None,
                    "startTime": None,
                    "endTime": None,
                    "coordinates": None
                }
            # </name>
            elif state == KmlTrackParser.ParsingState.PLACEMARK and event == 'end' and element.tag == "{http://www.opengis.net/kml/2.2}name":
                current_placemark["name"] = element.text
            # <TimeSpan>
            elif state == KmlTrackParser.ParsingState.PLACEMARK and event == 'start' and element.tag == "{http://www.opengis.net/kml/2.2}TimeSpan":
                state = KmlTrackParser.ParsingState.TIMESPAN
                current_timespan = {
                    "begin": None,
                    "end": None
                }
            # </begin>
            elif state == KmlTrackParser.ParsingState.TIMESPAN and event == 'end' and element.tag == "{http://www.opengis.net/kml/2.2}begin":
                current_timespan["begin"] = datetime.fromisoformat(element.text.replace('Z', '+00:00'))
            # </end>
            elif state == KmlTrackParser.ParsingState.TIMESPAN and event == 'end' and element.tag == "{http://www.opengis.net/kml/2.2}end":
                current_timespan["end"] = datetime.fromisoformat(element.text.replace('Z', '+00:00'))
            # </TimeSpan>
            elif state == KmlTrackParser.ParsingState.TIMESPAN and event == 'end' and element.tag == "{http://www.opengis.net/kml/2.2}TimeSpan":
                state = KmlTrackParser.ParsingState.PLACEMARK
                current_placemark["startTime"] = current_timespan["begin"]
                current_placemark["endTime"] = current_timespan["end"]    
            # </coordinates>
            elif state == KmlTrackParser.ParsingState.PLACEMARK and event == 'end' and element.tag == "{http://www.opengis.net/kml/2.2}coordinates":
                current_placemark["coordinates"] = element.text.strip().split(" ")
            # </Placemark>
            elif state == KmlTrackParser.ParsingState.PLACEMARK and event == 'end' and element.tag == "{http://www.opengis.net/kml/2.2}Placemark":
                state = KmlTrackParser.ParsingState.NONE
                gps_fixes = []
                if len(current_placemark["coordinates"]) > 1:
                    step = (current_placemark["endTime"] - current_placemark["startTime"]) / (len(current_placemark["coordinates"]) - 1)
                    time_cursor = current_placemark["startTime"]
                    for coord in current_placemark["coordinates"]:
                        longLatAlt = coord.split(",")
                        gps_fixes.append(GpsFix(time_cursor, Coordinate(float(longLatAlt[0]), float(longLatAlt[1]), float(longLatAlt[2]))))
                        time_cursor = time_cursor + step
                else:
                    longLatAlt = current_placemark["coordinates"][0].split(",")
                    gps_fixes.append(GpsFix(current_placemark["startTime"], Coordinate(float(longLatAlt[0]), float(longLatAlt[1]), float(longLatAlt[2]))))
                    gps_fixes.append(GpsFix(current_placemark["endTime"], Coordinate(float(longLatAlt[0]), float(longLatAlt[1]), float(longLatAlt[2]))))
                track.add_section(GpsTrackSection(current_placemark["name"], gps_fixes))
        return track
def has_timezone(dt):
    return (not dt is None) and (not dt.tzinfo is None) and (not dt.tzinfo.utcoffset(dt) is None)

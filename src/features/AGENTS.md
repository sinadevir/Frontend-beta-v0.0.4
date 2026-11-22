# Domain API modules

- As-of query params that default to "now" are rounded to the minute (`asOfNow`), because they are part of the query key; a fresh timestamp per render refetched forever.

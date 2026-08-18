-- reserve.lua : atomically reserve stock
-- KEYS[1] = stock:{productId}
-- KEYS[2] = reservation:{reservationId}
-- KEYS[3] = reservations:pending  (ZSET, score = expiry ms)
-- ARGV[1] = qty
-- ARGV[2] = productId
-- ARGV[3] = userId
-- ARGV[4] = expiresAtMs
-- ARGV[5] = reservationId
-- Returns:  1 = reserved | 0 = insufficient stock | -1 = sale not warmed/active

local stock = redis.call('GET', KEYS[1])
if not stock then
  return -1
end

stock = tonumber(stock)
local qty = tonumber(ARGV[1])

if stock < qty then
  return 0
end

redis.call('DECRBY', KEYS[1], qty)

redis.call('HSET', KEYS[2],
  'productId', ARGV[2],
  'userId', ARGV[3],
  'qty', qty,
  'expiresAt', ARGV[4],
  'status', 'RESERVED')

-- Key self-expires 30s past the window as a cleanup backstop.
redis.call('PEXPIREAT', KEYS[2], tonumber(ARGV[4]) + 30000)

-- Track for the reaper so stock is reclaimed on timeout.
redis.call('ZADD', KEYS[3], ARGV[4], ARGV[5])

return 1

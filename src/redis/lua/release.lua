-- release.lua : return reserved stock (reaper on expiry, or checkout compensation)
-- KEYS[1] = stock:{productId}
-- KEYS[2] = reservation:{reservationId}
-- KEYS[3] = reservations:pending
-- ARGV[1] = reservationId
-- Returns: qty returned, or 0 if nothing to do (already consumed/released)

if redis.call('EXISTS', KEYS[2]) == 0 then
  return 0
end

local status = redis.call('HGET', KEYS[2], 'status')
if status ~= 'RESERVED' then
  -- Consumed or already released: never double-return stock.
  return 0
end

local qty = tonumber(redis.call('HGET', KEYS[2], 'qty'))

redis.call('INCRBY', KEYS[1], qty)
redis.call('HSET', KEYS[2], 'status', 'RELEASED')
redis.call('ZREM', KEYS[3], ARGV[1])
redis.call('PEXPIRE', KEYS[2], 60000)

return qty

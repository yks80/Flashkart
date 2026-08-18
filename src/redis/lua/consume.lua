-- consume.lua : lock in a reservation at checkout
-- KEYS[1] = reservation:{reservationId}
-- KEYS[2] = reservations:pending
-- ARGV[1] = reservationId
-- ARGV[2] = userId
-- ARGV[3] = nowMs
-- Returns: {qty, productId} on success
--          -1 = expired / not found
--          -2 = already consumed
--          -3 = past expiry
--          -4 = not the owner

if redis.call('EXISTS', KEYS[1]) == 0 then
  return -1
end

if redis.call('HGET', KEYS[1], 'status') ~= 'RESERVED' then
  return -2
end

if tonumber(ARGV[3]) > tonumber(redis.call('HGET', KEYS[1], 'expiresAt')) then
  return -3
end

if redis.call('HGET', KEYS[1], 'userId') ~= ARGV[2] then
  return -4
end

local qty = redis.call('HGET', KEYS[1], 'qty')
local pid = redis.call('HGET', KEYS[1], 'productId')

redis.call('HSET', KEYS[1], 'status', 'CONSUMED')
-- Remove from the reaper so its stock is NOT returned.
redis.call('ZREM', KEYS[2], ARGV[1])
redis.call('PEXPIRE', KEYS[1], 60000)

return { tonumber(qty), pid }

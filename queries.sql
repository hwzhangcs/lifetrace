-- psql -v ON_ERROR_STOP=1 -f queries.sql
-- Change these demonstration parameters as needed.
\set asset_id 1
\set component_id 1
\set batch_id 1
\set at '2026-05-01T12:00:00+08:00'

-- Q1: current composition, including empty slots
SELECT s.slot_name,c.serial_no,b.batch_code,b.recall_status
FROM asset_slots s
LEFT JOIN installations i ON i.asset_slot_id=s.id AND i.removed_at IS NULL
LEFT JOIN components c ON c.id=i.component_id
LEFT JOIN component_batches b ON b.id=c.batch_id
WHERE s.asset_id=:asset_id ORDER BY s.id;

-- Q2: historical composition, half-open interval [start,end)
SELECT s.slot_name,c.serial_no,i.installed_at,i.removed_at
FROM asset_slots s
LEFT JOIN installations i ON i.asset_slot_id=s.id
  AND i.installed_at<=:'at'::timestamptz
  AND (i.removed_at IS NULL OR i.removed_at>:'at'::timestamptz)
LEFT JOIN components c ON c.id=i.component_id
WHERE s.asset_id=:asset_id AND s.created_at<=:'at'::timestamptz ORDER BY s.id;

-- Q3: a physical component's installation history
SELECT a.asset_code,s.slot_name,i.installed_at,i.removed_at,
       u.name AS installed_by,e.note
FROM installations i
JOIN asset_slots s ON s.id=i.asset_slot_id
JOIN assets a ON a.id=s.asset_id
JOIN maintenance_events e ON e.id=i.installed_event_id
JOIN users u ON u.id=e.technician_id
WHERE i.component_id=:component_id ORDER BY i.installed_at;

-- Q4: unique currently exposed assets
SELECT DISTINCT a.id,a.asset_code,a.model_name
FROM components c
JOIN installations i ON i.component_id=c.id AND i.removed_at IS NULL
JOIN asset_slots s ON s.id=i.asset_slot_id
JOIN assets a ON a.id=s.asset_id
WHERE c.batch_id=:batch_id ORDER BY a.asset_code;

-- Q5: unique historically exposed assets, includes current exposure
SELECT DISTINCT a.id,a.asset_code,a.model_name
FROM components c
JOIN installations i ON i.component_id=c.id
JOIN asset_slots s ON s.id=i.asset_slot_id
JOIN assets a ON a.id=s.asset_id
WHERE c.batch_id=:batch_id ORDER BY a.asset_code;

-- Migration: Backfill order activities for existing orders
-- This script creates 'created' activity records for all existing orders

SET client_encoding TO 'UTF8';

-- Step 1: Create 'created' activity for all existing orders
-- Use created_by if available, otherwise use customer_id
INSERT INTO order_activities (
    order_id,
    user_id,
    action_type,
    action_text,
    extra_data,
    is_visible_to_customer,
    created_at
)
SELECT 
    o.id as order_id,
    COALESCE(o.created_by, o.customer_id) as user_id,
    'created' as action_type,
    '创建订单 ' || o.order_number as action_text,
    jsonb_build_object(
        'order_number', o.order_number,
        'customer_id', o.customer_id,
        'status', o.status,
        'order_type', o.order_type,
        'order_date', o.order_date
    ) as extra_data,
    true as is_visible_to_customer,
    COALESCE(o.order_date, o.created_at) as created_at
FROM orders o
WHERE NOT EXISTS (
    SELECT 1 FROM order_activities oa 
    WHERE oa.order_id = o.id AND oa.action_type = 'created'
)
ORDER BY o.id;

-- Step 2: Create 'assigned' activities for orders that have been assigned
INSERT INTO order_activities (
    order_id,
    user_id,
    action_type,
    action_text,
    extra_data,
    is_visible_to_customer,
    created_at
)
SELECT 
    o.id as order_id,
    o.created_by as user_id, -- Use order creator as the assigner
    'assigned' as action_type,
    CASE 
        WHEN pm.username IS NOT NULL THEN '将订单分配给：' || pm.username
        ELSE '分配订单给生产跟单'
    END as action_text,
    jsonb_build_object(
        'assigned_to', o.assigned_to,
        'assigned_to_name', pm.username
    ) as extra_data,
    true as is_visible_to_customer,
    COALESCE(
        (SELECT MIN(oa.assigned_at) FROM order_assignments oa WHERE oa.order_id = o.id),
        o.updated_at
    ) as created_at
FROM orders o
LEFT JOIN users pm ON o.assigned_to = pm.id
WHERE o.assigned_to IS NOT NULL
    AND o.status = 'assigned'
    AND NOT EXISTS (
        SELECT 1 FROM order_activities oa 
        WHERE oa.order_id = o.id 
            AND oa.action_type = 'assigned'
            AND oa.created_at <= COALESCE(
                (SELECT MIN(oa2.assigned_at) FROM order_assignments oa2 WHERE oa2.order_id = o.id),
                o.updated_at
            ) + INTERVAL '1 minute'
    )
ORDER BY o.id;

-- Step 3: Create 'status_changed' activities for orders with status history
INSERT INTO order_activities (
    order_id,
    user_id,
    action_type,
    action_text,
    extra_data,
    is_visible_to_customer,
    created_at
)
SELECT 
    osh.order_id,
    osh.changed_by as user_id,
    'status_changed' as action_type,
    CASE 
        WHEN osh.new_status = 'pending' THEN '订单状态变更为：待处理'
        WHEN osh.new_status = 'assigned' THEN '订单状态变更为：已分配'
        WHEN osh.new_status = 'in_production' THEN '订单状态变更为：生产中'
        WHEN osh.new_status = 'completed' THEN '订单状态变更为：已完成'
        WHEN osh.new_status = 'shipped' THEN '订单状态变更为：已发货'
        WHEN osh.new_status = 'cancelled' THEN '订单状态变更为：已取消'
        ELSE '订单状态变更为：' || osh.new_status
    END as action_text,
    jsonb_build_object(
        'old_status', osh.old_status,
        'new_status', osh.new_status,
        'notes', osh.notes
    ) as extra_data,
    true as is_visible_to_customer,
    osh.created_at
FROM order_status_history osh
WHERE osh.new_status IS NOT NULL
    AND osh.old_status != osh.new_status
    AND NOT EXISTS (
        SELECT 1 FROM order_activities oa 
        WHERE oa.order_id = osh.order_id 
            AND oa.action_type = 'status_changed'
            AND oa.created_at BETWEEN osh.created_at - INTERVAL '1 minute' AND osh.created_at + INTERVAL '1 minute'
            AND (oa.extra_data->>'new_status') = osh.new_status
    )
ORDER BY osh.order_id, osh.created_at;

-- Step 4: Create 'completed' activities for completed orders
INSERT INTO order_activities (
    order_id,
    user_id,
    action_type,
    action_text,
    extra_data,
    is_visible_to_customer,
    created_at
)
SELECT 
    o.id as order_id,
    o.created_by as user_id,
    'completed' as action_type,
    '标记订单为已完成生产' as action_text,
    jsonb_build_object(
        'is_completed', true,
        'status', o.status
    ) as extra_data,
    true as is_visible_to_customer,
    o.updated_at as created_at
FROM orders o
WHERE o.is_completed = true
    AND NOT EXISTS (
        SELECT 1 FROM order_activities oa 
        WHERE oa.order_id = o.id AND oa.action_type = 'completed'
    )
ORDER BY o.id;

-- Step 5: Create 'can_ship' activities for orders that can ship
INSERT INTO order_activities (
    order_id,
    user_id,
    action_type,
    action_text,
    extra_data,
    is_visible_to_customer,
    created_at
)
SELECT 
    o.id as order_id,
    o.created_by as user_id,
    'can_ship' as action_type,
    '标记订单可以出货' as action_text,
    jsonb_build_object(
        'can_ship', true
    ) as extra_data,
    true as is_visible_to_customer,
    o.updated_at as created_at
FROM orders o
WHERE o.can_ship = true
    AND NOT EXISTS (
        SELECT 1 FROM order_activities oa 
        WHERE oa.order_id = o.id AND oa.action_type = 'can_ship'
    )
ORDER BY o.id;

-- Step 6: Create 'shipped' activities for shipped orders
INSERT INTO order_activities (
    order_id,
    user_id,
    action_type,
    action_text,
    extra_data,
    is_visible_to_customer,
    created_at
)
SELECT 
    o.id as order_id,
    o.created_by as user_id,
    'shipped' as action_type,
    '订单已发货' as action_text,
    jsonb_build_object(
        'status', o.status,
        'actual_ship_date', o.actual_ship_date,
        'shipping_tracking_numbers', o.shipping_tracking_numbers
    ) as extra_data,
    true as is_visible_to_customer,
    COALESCE(o.actual_ship_date::timestamp, o.updated_at) as created_at
FROM orders o
WHERE o.status = 'shipped'
    AND NOT EXISTS (
        SELECT 1 FROM order_activities oa 
        WHERE oa.order_id = o.id AND oa.action_type = 'shipped'
    )
ORDER BY o.id;

-- Step 7: Create 'follow_up_added' activities from existing follow-ups
INSERT INTO order_activities (
    order_id,
    user_id,
    action_type,
    action_text,
    extra_data,
    is_visible_to_customer,
    created_at
)
SELECT 
    ofu.order_id,
    ofu.production_manager_id as user_id,
    'follow_up_added' as action_type,
    '生产跟单添加跟进：' || LEFT(ofu.content, 100) as action_text,
    jsonb_build_object(
        'follow_up_id', ofu.id,
        'content', ofu.content
    ) as extra_data,
    ofu.is_visible_to_customer,
    ofu.created_at
FROM order_follow_ups ofu
WHERE NOT EXISTS (
    SELECT 1 FROM order_activities oa 
    WHERE oa.order_id = ofu.order_id 
        AND oa.action_type = 'follow_up_added'
        AND oa.created_at BETWEEN ofu.created_at - INTERVAL '1 minute' AND ofu.created_at + INTERVAL '1 minute'
        AND (oa.extra_data->>'follow_up_id')::int = ofu.id
)
ORDER BY ofu.order_id, ofu.created_at;

-- Verification query
SELECT 
    'Total orders' as metric,
    COUNT(*) as count
FROM orders
UNION ALL
SELECT 
    'Orders with created activity' as metric,
    COUNT(DISTINCT oa.order_id) as count
FROM order_activities oa
WHERE oa.action_type = 'created'
UNION ALL
SELECT 
    'Total activities' as metric,
    COUNT(*) as count
FROM order_activities;


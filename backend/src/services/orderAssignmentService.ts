import { pool } from '../config/database.js';
import type { PoolClient } from 'pg';

export interface OrderAssignmentSummary {
  ids: number[];
  names: string[];
  team: Array<{ id: number; username: string | null; admin_notes?: string | null }>;
}

type DBClient = PoolClient;

const getClient = (client?: DBClient) => client ?? pool;

export const ORDER_ASSIGNMENT_COLUMNS = `
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', oa.production_manager_id,
          'username', pm_assign.username,
          'admin_notes', pm_assign.admin_notes
        )
        ORDER BY oa.assigned_at DESC
      )
      FROM order_assignments oa
      LEFT JOIN users pm_assign ON oa.production_manager_id = pm_assign.id
      WHERE oa.order_id = o.id
    ),
    '[]'::json
  ) AS assigned_team,
  COALESCE(
    (
      SELECT array_agg(oa_ids.production_manager_id ORDER BY oa_ids.assigned_at DESC)
      FROM order_assignments oa_ids
      WHERE oa_ids.order_id = o.id
    ),
    ARRAY[]::INTEGER[]
  ) AS assigned_to_ids,
  COALESCE(
    (
      SELECT array_agg(pm_assign_names.username ORDER BY oa_names.assigned_at DESC)
      FROM order_assignments oa_names
      LEFT JOIN users pm_assign_names ON oa_names.production_manager_id = pm_assign_names.id
      WHERE oa_names.order_id = o.id
    ),
    ARRAY[]::TEXT[]
  ) AS assigned_to_names
`;

export async function syncOrderAssignments(
  client: DBClient,
  orderId: number,
  productionManagerIds: number[],
  assignedBy: number | null
): Promise<{ added: number[]; removed: number[]; current: number[] }> {
  const uniqueIds = Array.from(new Set(productionManagerIds));
  const existingResult = await client.query(
    'SELECT production_manager_id FROM order_assignments WHERE order_id = $1',
    [orderId]
  );
  const existingIds = existingResult.rows.map((row) => row.production_manager_id as number);

  const toAdd = uniqueIds.filter((id) => !existingIds.includes(id));
  const toRemove = existingIds.filter((id) => !uniqueIds.includes(id));

  if (toAdd.length > 0) {
    const values = toAdd
      .map(
        (_, index) =>
          `($1, $${index + 2}, ${assignedBy != null ? `$${toAdd.length + 2}` : 'NULL'}, CURRENT_TIMESTAMP)`
      )
      .join(', ');
    const params: any[] = [orderId, ...toAdd];
    if (assignedBy != null) {
      params.push(assignedBy);
    }
    await client.query(
      `INSERT INTO order_assignments (order_id, production_manager_id, assigned_by, assigned_at)
       VALUES ${values}`,
      params
    );
  }

  if (toRemove.length > 0) {
    await client.query(
      'DELETE FROM order_assignments WHERE order_id = $1 AND production_manager_id = ANY($2::int[])',
      [orderId, toRemove]
    );
  }

  return {
    added: toAdd,
    removed: toRemove,
    current: uniqueIds,
  };
}

export async function getOrderAssignmentsSummary(
  orderId: number,
  client?: DBClient
): Promise<OrderAssignmentSummary> {
  const db = getClient(client);
  const result = await db.query(
    `
      SELECT oa.production_manager_id, pm.username, pm.admin_notes
      FROM order_assignments oa
      LEFT JOIN users pm ON oa.production_manager_id = pm.id
      WHERE oa.order_id = $1
      ORDER BY oa.assigned_at DESC
    `,
    [orderId]
  );

  const team = result.rows.map((row) => ({
    id: row.production_manager_id,
    username: row.username,
    admin_notes: row.admin_notes,
  }));
  const ids = team.map((member) => member.id);
  const names = team.map((member) => member.username ?? '');

  return {
    ids,
    names,
    team,
  };
}

export async function isOrderAssignedToUser(
  orderId: number,
  userId: number,
  client?: DBClient
): Promise<boolean> {
  const db = getClient(client);
  const result = await db.query(
    `
      SELECT 1
      FROM order_assignments
      WHERE order_id = $1 AND production_manager_id = $2
      LIMIT 1
    `,
    [orderId, userId]
  );
  if (result.rows.length > 0) {
    return true;
  }

  // 兼容旧数据：回退到 orders.assigned_to
  const legacyResult = await db.query(
    'SELECT 1 FROM orders WHERE id = $1 AND assigned_to = $2 LIMIT 1',
    [orderId, userId]
  );
  return legacyResult.rows.length > 0;
}


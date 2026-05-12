import { Db, ObjectId } from 'mongodb';
import { StockMovement, StockMovementType } from './types';
import { AuthenticatedUser } from './auth-api';
import { v4 as uuidv4 } from 'uuid';

export async function logStockMovement(
  db: Db,
  itemData: { id: string; sku: string; name: string; companyId?: string; companyName?: string },
  movement: {
    type: StockMovementType;
    quantity: number;
    fromPositionId?: string;
    fromPositionName?: string;
    toPositionId?: string;
    toPositionName?: string;
    reason: string;
    user: AuthenticatedUser;
  }
) {
  const movementLog: StockMovement = {
    id: uuidv4(),
    itemId: itemData.id,
    sku: itemData.sku,
    itemName: itemData.name,
    type: movement.type,
    quantity: movement.quantity,
    fromPositionId: movement.fromPositionId,
    fromPositionName: movement.fromPositionName,
    toPositionId: movement.toPositionId,
    toPositionName: movement.toPositionName,
    reason: movement.reason,
    userId: movement.user.userId,
    username: movement.user.username,
    timestamp: new Date().toISOString(),
    companyId: itemData.companyId,
    companyName: itemData.companyName,
  };

  await db.collection('stock_movements').insertOne(movementLog as any);
  
  // Also update the item's lastActivity
  if (ObjectId.isValid(itemData.id)) {
    await db.collection('stock_items').updateOne(
        { _id: new ObjectId(itemData.id) },
        { $set: { lastActivity: movementLog.timestamp } }
    );
  }
}

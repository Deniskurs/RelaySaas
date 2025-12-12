/**
 * Data transformation utilities
 * Converts snake_case API responses to camelCase for frontend components
 */

/**
 * Transform a trade from API format to frontend format
 * @param {Object} trade - Trade object from API (snake_case)
 * @returns {Object} Transformed trade object (camelCase)
 */
export const transformTrade = (trade) => {
  if (!trade) return null;

  return {
    id: trade.id,
    signalId: trade.signal_id,
    orderId: trade.order_id,
    symbol: trade.symbol,
    type: trade.direction, // API uses 'direction', frontend uses 'type'
    size: trade.lot_size,
    entryPrice: trade.entry_price || trade.open_price,
    currentPrice: trade.current_price || trade.open_price || trade.entry_price,
    stopLoss: trade.stop_loss,
    takeProfit: trade.take_profit,
    tpIndex: trade.tp_index,
    status: trade.status,
    profit: trade.profit ?? 0,
    openedAt: trade.opened_at,
    closedAt: trade.closed_at,
  };
};

/**
 * Transform an array of trades
 * @param {Array} trades - Array of trades from API
 * @returns {Array} Array of transformed trades
 */
export const transformTrades = (trades) => {
  if (!Array.isArray(trades)) return [];
  return trades.map(transformTrade).filter(Boolean);
};

/**
 * Transform a signal from API format to frontend format
 * @param {Object} signal - Signal object from API (snake_case)
 * @returns {Object} Transformed signal object (camelCase)
 */
export const transformSignal = (signal) => {
  if (!signal) return null;

  return {
    id: signal.id,
    rawMessage: signal.raw_message,
    channelName: signal.channel_name,
    channelId: signal.channel_id,
    symbol: signal.symbol,
    type: signal.direction, // API uses 'direction', frontend uses 'type'
    price: signal.entry_price,
    entryPrice: signal.entry_price,
    stopLoss: signal.stop_loss,
    takeProfits: signal.take_profits || [],
    confidence: signal.confidence,
    warnings: signal.warnings || [],
    status: signal.status,
    failureReason: signal.failure_reason,
    timestamp: signal.received_at,
    receivedAt: signal.received_at,
    parsedAt: signal.parsed_at,
    executedAt: signal.executed_at,
  };
};

/**
 * Transform an array of signals
 * @param {Array} signals - Array of signals from API
 * @returns {Array} Array of transformed signals
 */
export const transformSignals = (signals) => {
  if (!Array.isArray(signals)) return [];
  return signals.map(transformSignal).filter(Boolean);
};

/**
 * Transform a MetaApi position to frontend format
 * @param {Object} position - Position object from MetaApi
 * @returns {Object} Transformed position object for OpenPositions component
 */
export const transformPosition = (position) => {
  if (!position) return null;

  // MetaApi returns type as "POSITION_TYPE_BUY" or "POSITION_TYPE_SELL"
  const type = position.type?.includes("BUY") ? "BUY" :
               position.type?.includes("SELL") ? "SELL" :
               position.type || "--";

  return {
    id: position.id || position.positionId,
    symbol: position.symbol,
    type: type,
    size: position.volume,
    entryPrice: position.openPrice,
    currentPrice: position.currentPrice,
    stopLoss: position.stopLoss,
    takeProfit: position.takeProfit,
    profit: position.profit ?? position.unrealizedProfit ?? 0,
    openedAt: position.time || position.openTime,
  };
};

/**
 * Transform an array of MetaApi positions
 * @param {Array} positions - Array of positions from MetaApi
 * @returns {Array} Array of transformed positions
 */
export const transformPositions = (positions) => {
  if (!Array.isArray(positions)) return [];
  return positions.map(transformPosition).filter(Boolean);
};

/**
 * Transform stats from API format to frontend format
 * @param {Object} stats - Stats object from API (snake_case)
 * @returns {Object} Transformed stats object (camelCase)
 */
export const transformStats = (stats) => {
  if (!stats) return null;

  return {
    totalSignals: stats.total_signals ?? 0,
    signalsToday: stats.signals_today ?? 0,
    totalTrades: stats.total_trades ?? 0,
    openTrades: stats.open_trades ?? 0,
    closedTrades: stats.closed_trades ?? 0,
    winningTrades: stats.winning_trades ?? 0,
    losingTrades: stats.losing_trades ?? 0,
    winRate: stats.win_rate ?? 0,
    totalProfit: stats.total_profit ?? 0,
    todayPnL: stats.today_profit ?? 0,
    // Keep original snake_case keys as fallback for components that might use them
    today_pnl: stats.today_profit ?? 0,
    win_rate: stats.win_rate ?? 0,
    open_trades: stats.open_trades ?? 0,
    signals_today: stats.signals_today ?? 0,
  };
};

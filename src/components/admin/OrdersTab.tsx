import React, { useState, useMemo } from 'react';
import { 
  Download, Upload, Search, Eye, ArrowLeft, AlertTriangle, 
  ChevronDown, ChevronUp, MoreHorizontal, Calendar, Truck, Tag, MessageSquare, Send, Trash2, RotateCcw, CheckSquare, Square,
  RefreshCw, CheckCircle2
} from 'lucide-react';
import { Order } from '../../types';
import { parseOrderTime } from '../../utils';
import { RoyalMailOrderActions } from './RoyalMailOrderActions';

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&q=80&w=300";

interface OrdersTabProps {
  orders: Order[];
  orderStatusFilter: 'All' | 'Unfulfilled' | 'Fulfilled';
  setOrderStatusFilter: (val: 'All' | 'Unfulfilled' | 'Fulfilled') => void;
  handleExportOrders: () => void;
  handleImportOrders: (e: React.ChangeEvent<HTMLInputElement>) => void;
  orderQuery: string;
  setOrderQuery: (val: string) => void;
  filteredOrders: Order[];
  selectedOrder: Order | null;
  setSelectedOrder: (order: Order | null) => void;
  parentOrders: Order[];
  parentOnUpdateOrders: (orders: Order[]) => void;
  timelineComments: Record<string, Array<{ text: string; date: string }>>;
  setTimelineComments: React.Dispatch<React.SetStateAction<Record<string, Array<{ text: string; date: string }>>>>;
  showTrackingModal: boolean;
  setShowTrackingModal: (val: boolean) => void;
  trackingNumberInput: string;
  setTrackingNumberInput: (val: string) => void;
  carrierInput: string;
  setCarrierInput: (val: string) => void;
  showConfirmDeleteModal: (title: string, message: string, onConfirm: () => void) => void;
}

export const OrdersTab: React.FC<OrdersTabProps> = ({
  orders,
  orderStatusFilter,
  setOrderStatusFilter,
  handleExportOrders,
  handleImportOrders,
  orderQuery,
  setOrderQuery,
  filteredOrders,
  selectedOrder,
  setSelectedOrder,
  parentOrders,
  parentOnUpdateOrders,
  timelineComments,
  setTimelineComments,
  showTrackingModal,
  setShowTrackingModal,
  trackingNumberInput,
  setTrackingNumberInput,
  carrierInput,
  setCarrierInput,
  showConfirmDeleteModal
}) => {
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [recentlyDeletedOrders, setRecentlyDeletedOrders] = useState<Order[]>([]);
  const [orderTypeFilter, setOrderTypeFilter] = useState<'All' | 'Standard' | 'Subscription'>('All');

  // Helper to detect if an order is a subscription order
  const isSubOrder = (order: Order) => {
    if (order.isSubscription) return true;
    if (Array.isArray(order.tags) && order.tags.some(t => t.toLowerCase().includes('subscription'))) return true;
    if (Array.isArray(order.items) && order.items.some((i: any) => 
      i.isSubscription || 
      i.vendor === 'Subscription Pack' || 
      (i.productTitle && (i.productTitle.toLowerCase().includes('subscription') || i.productTitle.toLowerCase().includes('pack')))
    )) return true;
    return false;
  };

  // Helper to extract subscription metadata for detailed display
  const getSubscriptionDetails = (order: Order) => {
    if (order.subscriptionDetails) return order.subscriptionDetails;

    const subItem = order.items?.find((i: any) => 
      i.isSubscription || 
      i.vendor === 'Subscription Pack' || 
      (i.productTitle && (i.productTitle.toLowerCase().includes('subscription') || i.productTitle.toLowerCase().includes('pack')))
    ) as any;

    let planName = subItem?.subscriptionPlan || 'LITE Plan';
    let frequency = subItem?.subscriptionFrequency || '';
    let frequencyDiscount = subItem?.frequencyDiscount || '';

    const title = (subItem?.productTitle || '').toLowerCase();
    if (title.includes('core')) planName = 'CORE Plan';
    else if (title.includes('pro')) planName = 'PRO Plan';
    else if (title.includes('ultimate')) planName = 'ULTIMATE Plan';
    else if (title.includes('lite')) planName = 'LITE Plan';

    if (!frequency) {
      if (title.includes('next day') || title.includes('1 day')) {
        frequency = 'Next Day (Test)';
      } else if (title.includes('weekly') && !title.includes('bi')) {
        frequency = 'Weekly';
      } else if (title.includes('bi-weekly') || title.includes('by weekly') || title.includes('2 week')) {
        frequency = 'Bi-Weekly';
      } else if (title.includes('month') || title.includes('one month')) {
        frequency = 'One Month';
      } else {
        frequency = 'Bi-Weekly';
      }
    }

    if (!frequencyDiscount) {
      if (frequency.includes('Next Day')) frequencyDiscount = '10%';
      else if (frequency === 'Weekly') frequencyDiscount = '5%';
      else if (frequency === 'One Month') frequencyDiscount = '12%';
      else frequencyDiscount = '10%';
    }

    const baseDate = order.createdAt ? new Date(order.createdAt) : new Date();
    const nextDate = new Date(baseDate);
    if (frequency.includes('Next Day')) {
      nextDate.setDate(baseDate.getDate() + 1);
    } else if (frequency === 'Weekly') {
      nextDate.setDate(baseDate.getDate() + 7);
    } else if (frequency === 'Bi-Weekly') {
      nextDate.setDate(baseDate.getDate() + 14);
    } else {
      nextDate.setDate(baseDate.getDate() + 30);
    }

    return {
      planName,
      frequency,
      frequencyDiscount,
      paymentStatus: order.paymentStatus || 'Paid',
      lastPaymentDate: baseDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      nextPaymentDate: nextDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    };
  };

  // Ensure newly created orders ALWAYS show at the very top (sorted newest first)
  const sortedFilteredOrders = useMemo(() => {
    let list = [...filteredOrders];
    if (orderTypeFilter === 'Subscription') {
      list = list.filter(isSubOrder);
    } else if (orderTypeFilter === 'Standard') {
      list = list.filter(o => !isSubOrder(o));
    }
    return list.sort((a, b) => parseOrderTime(b) - parseOrderTime(a));
  }, [filteredOrders, orderTypeFilter]);

  const allVisibleSelected = sortedFilteredOrders.length > 0 && sortedFilteredOrders.every(o => selectedOrderIds.includes(String(o.id)));

  const handleToggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(sortedFilteredOrders.map(o => String(o.id)));
    }
  };

  const handleToggleSelectOrder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkDeleteOrders = () => {
    if (selectedOrderIds.length === 0) return;
    showConfirmDeleteModal(
      "Bulk Delete Selected Orders",
      `Are you sure you want to delete ${selectedOrderIds.length} selected order(s)? You can immediately restore them using the Undo button.`,
      () => {
        const ordersToDelete = parentOrders.filter(o => selectedOrderIds.includes(String(o.id)));
        const remainingOrders = parentOrders.filter(o => !selectedOrderIds.includes(String(o.id)));

        setRecentlyDeletedOrders(ordersToDelete);
        setSelectedOrderIds([]);
        parentOnUpdateOrders(remainingOrders);

        // Send explicit DELETE requests to API for each order
        ordersToDelete.forEach(o => {
          fetch(`/api/orders/${o.id}`, { method: 'DELETE' }).catch(err => console.warn('Failed API DELETE for order:', o.id, err));
        });

        // Auto hide undo banner after 20s
        setTimeout(() => {
          setRecentlyDeletedOrders([]);
        }, 20000);
      }
    );
  };

  const handleDeleteSingleOrder = (orderToDelete: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    showConfirmDeleteModal(
      `Delete Order #${orderToDelete.id}`,
      `Are you sure you want to delete Order #${orderToDelete.id}? An undo option will be available to restore it.`,
      () => {
        setRecentlyDeletedOrders([orderToDelete]);
        if (selectedOrder && String(selectedOrder.id) === String(orderToDelete.id)) {
          setSelectedOrder(null);
        }
        parentOnUpdateOrders(parentOrders.filter(o => String(o.id) !== String(orderToDelete.id)));

        // Send explicit DELETE request to API
        fetch(`/api/orders/${orderToDelete.id}`, { method: 'DELETE' }).catch(err => console.warn('Failed API DELETE for order:', orderToDelete.id, err));

        setTimeout(() => {
          setRecentlyDeletedOrders([]);
        }, 20000);
      }
    );
  };

  const handleUndoDelete = () => {
    if (recentlyDeletedOrders.length === 0) return;
    const restoredMap = new Map();
    [...recentlyDeletedOrders, ...parentOrders].forEach(o => restoredMap.set(String(o.id), o));
    parentOnUpdateOrders(Array.from(restoredMap.values()));
    setRecentlyDeletedOrders([]);
  };

  return (
    <div className="space-y-6">

      {/* Persistent Undo Banner */}
      {recentlyDeletedOrders.length > 0 && (
        <div className="bg-amber-900 text-amber-50 border border-amber-700/80 p-3.5 px-5 rounded-xl shadow-lg flex items-center justify-between gap-4 animate-slide-down">
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <Trash2 className="h-4 w-4 text-amber-400 shrink-0" />
            <span>Successfully deleted {recentlyDeletedOrders.length} order(s).</span>
          </div>
          <button
            onClick={handleUndoDelete}
            className="bg-amber-400 hover:bg-amber-300 text-amber-950 font-black py-1.5 px-3.5 rounded-lg text-xs inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Undo Delete
          </button>
        </div>
      )}

      {/* Bulk Delete Selection Floating Action Bar */}
      {selectedOrderIds.length > 0 && (
        <div className="bg-slate-900 text-white p-3 px-5 rounded-xl border border-slate-800 shadow-xl flex items-center justify-between gap-4">
          <div className="text-xs font-bold text-slate-200">
            <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md font-black text-[11px] mr-2">
              {selectedOrderIds.length}
            </span>
            order(s) selected for bulk action
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkDeleteOrders}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 px-3.5 rounded-lg text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete Selected ({selectedOrderIds.length})
            </button>
            <button
              onClick={() => setSelectedOrderIds([])}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-1.5 px-3 rounded-lg text-xs cursor-pointer transition"
            >
              Deselect
            </button>
          </div>
        </div>
      )}
      
      {/* Table actions header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Fulfillment Status Tabs */}
          <div className="flex flex-wrap gap-1">
            {(['All', 'Unfulfilled', 'Fulfilled'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setOrderStatusFilter(tab)}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  orderStatusFilter === tab 
                    ? 'bg-slate-900 border-slate-900 text-white' 
                    : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab} ({tab === 'All' ? orders.length : orders.filter(o => o.fulfillmentStatus === tab).length})
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Customer / Subscription Toggle Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => setOrderTypeFilter('All')}
              className={`py-1 px-2.5 rounded-lg font-bold transition-all cursor-pointer ${
                orderTypeFilter === 'All'
                  ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setOrderTypeFilter('Standard')}
              className={`py-1 px-2.5 rounded-lg font-bold transition-all cursor-pointer ${
                orderTypeFilter === 'Standard'
                  ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Standard
            </button>
            <button
              onClick={() => setOrderTypeFilter('Subscription')}
              className={`py-1 px-3 rounded-lg font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                orderTypeFilter === 'Subscription'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-indigo-700 hover:bg-indigo-50 font-black'
              }`}
            >
              <RefreshCw className="w-3 h-3" />
              Subscriptions ({orders.filter(isSubOrder).length})
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleExportOrders}
            className="bg-white hover:bg-slate-50 border border-slate-200 font-bold p-2 px-2.5 rounded-lg text-xs text-slate-700 flex items-center gap-1 transition cursor-pointer shadow-2xs"
            title="Export all orders to JSON backup file"
          >
            <Download className="h-3 w-3 text-slate-500" /> Export Backup
          </button>

          <label
            className="bg-white hover:bg-slate-50 border border-slate-200 font-bold p-2 px-2.5 rounded-lg text-xs text-slate-700 flex items-center gap-1 transition cursor-pointer shadow-2xs cursor-pointer"
            title="Import orders from JSON backup"
          >
            <Upload className="h-3 w-3 text-slate-500" /> Import Backup
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportOrders}
            />
          </label>

          {/* Query filter input */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Filter ID, customers..."
              value={orderQuery}
              onChange={(e) => setOrderQuery(e.target.value)}
              className="w-full text-xs p-2 pb-2 pl-8 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-500 bg-slate-50"
            />
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Orders list Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[10px] text-slate-450 font-black uppercase tracking-widest">
                <th className="p-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleToggleSelectAll}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    title="Select / Deselect all"
                  />
                </th>
                <th className="p-4">Order ID</th>
                <th className="p-4">Created Date</th>
                <th className="p-4">Customer</th>
                <th className="p-4 text-center">Fulfillment Status</th>
                <th className="p-4 text-right">Invoice Total</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedFilteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">No matching orders found.</td>
                </tr>
              ) : (
                sortedFilteredOrders.map(order => {
                  const isSelected = selectedOrderIds.includes(String(order.id));
                  return (
                    <tr 
                      key={order.id} 
                      className={`hover:bg-slate-50/70 transition-colors ${isSelected ? 'bg-amber-50/50' : ''}`}
                    >
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleSelectOrder(String(order.id), e as any)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                        />
                      </td>
                      <td className="p-4 font-extrabold text-slate-900">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>#{order.id}</span>
                          {isSubOrder(order) && (
                            <span className="inline-flex items-center gap-1 text-[8.5px] bg-indigo-600 text-white font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-2xs">
                              <RefreshCw className="w-2.5 h-2.5" />
                              Subscription ({getSubscriptionDetails(order).planName})
                            </span>
                          )}
                        </div>
                        {Array.isArray(order.tags) && order.tags.includes('Withdrawal Requested') && (
                          <span className="inline-block text-[8.5px] bg-rose-50 text-rose-700 border border-rose-150 uppercase font-black px-1.5 py-0.5 rounded mt-1 animate-pulse select-none">
                            Withdrawal Pending
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-slate-500 font-medium">{order.date}</td>
                      <td className="p-4">
                        <p className="font-bold text-slate-850">{order.customerName}</p>
                        <p className="text-[10px] text-slate-400">{order.customerEmail}</p>
                        {isSubOrder(order) && (
                          <div className="mt-1 text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md px-1.5 py-0.5 inline-block">
                            🔄 {getSubscriptionDetails(order).frequency} ({getSubscriptionDetails(order).frequencyDiscount} OFF)
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-block text-[10px] uppercase font-bold py-0.5 px-2 rounded-full tracking-wider ${
                          order.fulfillmentStatus === 'Fulfilled' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {order.fulfillmentStatus}
                        </span>
                      </td>
                      <td className="p-4 text-right font-extrabold text-slate-900">£{(Number(order.total) || 0).toFixed(2)}</td>
                      <td className="p-4 text-center flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-xs bg-slate-100 hover:bg-slate-200 border border-slate-250 hover:text-slate-900 text-slate-600 py-1 px-2.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="h-3 w-3" /> View
                        </button>
                        <button
                          onClick={(e) => handleDeleteSingleOrder(order, e)}
                          className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 p-1.5 rounded-lg transition cursor-pointer"
                          title="Delete Order"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Order Detailed Shopify-Style Full Overlay Page */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-[#F6F6F7] overflow-y-auto font-sans text-slate-800">
          
          {/* Header Top Bar */}
          <div className="border-b border-slate-200 bg-white sticky top-0 z-10 shadow-3xs">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 cursor-pointer select-none transition-all border border-slate-200 bg-white shadow-3xs"
                  title="Back to Orders"
                >
                  <ArrowLeft className="h-4 w-4 stroke-[2.5]" />
                </button>
                
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">#{selectedOrder.id}</h1>
                  <span className="text-[10px] font-black uppercase py-1 px-3.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-full tracking-wider shadow-3xs select-none">
                    {selectedOrder.paymentStatus || 'Paid'}
                  </span>
                  <span className="text-[10px] font-black uppercase py-1 px-3.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-full tracking-wider shadow-3xs select-none">
                    {selectedOrder.fulfillmentStatus}
                  </span>
                  <span className="text-[10px] font-black uppercase py-1 px-3.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-full tracking-wider shadow-3xs select-none">
                    Archived
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const updatedOrder = { ...selectedOrder, paymentStatus: 'Refunded' as const };
                    const updated = parentOrders.map(o => o.id === selectedOrder.id ? updatedOrder : o);
                    parentOnUpdateOrders(updated);
                    setSelectedOrder(updatedOrder);
                    
                    const refundComment = "Order was fully refunded.";
                    setTimelineComments(prev => ({
                      ...prev,
                      [selectedOrder.id]: [{ text: refundComment, date: 'Just now' }, ...(prev[selectedOrder.id] || [])]
                    }));

                    // Send refund email trigger
                    fetch('/api/email/send-trigger', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        type: 'order_refunded',
                        orderData: updatedOrder,
                        refundAmount: updatedOrder.total,
                        reason: 'Admin issued refund'
                      })
                    }).catch(err => console.warn('[Admin Refund Email Error]', err));
                  }}
                  className="py-1.5 px-3 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg text-xs font-bold transition-all shadow-3xs cursor-pointer"
                >
                  Refund
                </button>

                <button
                  onClick={() => {
                    const updatedOrder = { ...selectedOrder, fulfillmentStatus: 'Cancelled' as const, paymentStatus: 'Refunded' as const };
                    const updated = parentOrders.map(o => o.id === selectedOrder.id ? updatedOrder : o);
                    parentOnUpdateOrders(updated);
                    setSelectedOrder(updatedOrder);

                    const cancelComment = "Order was cancelled by admin.";
                    setTimelineComments(prev => ({
                      ...prev,
                      [selectedOrder.id]: [{ text: cancelComment, date: 'Just now' }, ...(prev[selectedOrder.id] || [])]
                    }));

                    // Send cancellation email trigger
                    fetch('/api/email/send-trigger', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        type: 'order_cancelled',
                        orderData: updatedOrder,
                        reason: 'Admin cancelled order'
                      })
                    }).catch(err => console.warn('[Admin Cancel Email Error]', err));
                  }}
                  className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-xs font-bold transition-all shadow-3xs cursor-pointer"
                >
                  Cancel Order
                </button>
                
                <button
                  onClick={() => {
                    const returnComment = "Exchange processed for order items.";
                    setTimelineComments(prev => ({
                      ...prev,
                      [selectedOrder.id]: [{ text: returnComment, date: 'Just now' }, ...(prev[selectedOrder.id] || [])]
                    }));

                    // Send exchange email trigger
                    fetch('/api/email/send-trigger', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        type: 'order_exchanged',
                        orderData: selectedOrder,
                        exchangeDetails: 'Admin initiated warranty item exchange'
                      })
                    }).catch(err => console.warn('[Admin Exchange Email Error]', err));
                  }}
                  className="py-1.5 px-3 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg text-xs font-bold transition-all shadow-3xs cursor-pointer"
                >
                  Exchange Item
                </button>
                
                <div className="relative group">
                  <button className="py-1.5 px-3 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-all shadow-3xs cursor-pointer">
                    <span>More actions</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>

                <div className="flex border border-slate-300 rounded-lg overflow-hidden divide-x divide-slate-300 shadow-3xs">
                  <button disabled className="p-1.5 bg-white text-slate-400 cursor-not-allowed">
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button disabled className="p-1.5 bg-white text-slate-400 cursor-not-allowed">
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

            </div>
          </div>

          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2">
            <p className="text-xs text-slate-500 font-medium pl-10">
              {selectedOrder.date || 'July 7, 2026 at 6:08 am'} from Draft Orders
            </p>
          </div>

          {/* Main 2-Column Grid */}
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">

              {/* SUBSCRIPTION CUSTOMER ORDER DETAILS PANEL */}
              {isSubOrder(selectedOrder) && (() => {
                const subDetails = getSubscriptionDetails(selectedOrder);
                return (
                  <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-400">
                          <RefreshCw className="w-5 h-5 animate-spin-slow" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-sm tracking-tight text-white uppercase">Subscription Customer Order</h3>
                            <span className="text-[9.5px] bg-emerald-500 text-slate-950 font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                              {subDetails.paymentStatus === 'Paid' ? 'PAID & ACTIVE' : subDetails.paymentStatus.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-medium">Recurring Subscription Delivery & Automatic Billing</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                      <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block mb-1">Subscription Plan</span>
                        <span className="font-black text-sm text-white">{subDetails.planName}</span>
                      </div>

                      <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block mb-1">Delivery Frequency</span>
                        <span className="font-black text-sm text-white">{subDetails.frequency}</span>
                        <span className="text-[10px] font-bold text-emerald-400 block mt-0.5">({subDetails.frequencyDiscount} Discount)</span>
                      </div>

                      <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block mb-1">Payment Status</span>
                        <span className="font-black text-sm text-emerald-400 flex items-center gap-1">
                          <CheckSquare className="w-3.5 h-3.5" /> Paid
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">£{(Number(selectedOrder.total) || 0).toFixed(2)} / cycle</span>
                      </div>

                      <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block mb-1">Next Payment Date</span>
                        <span className="font-black text-sm text-amber-300">{subDetails.nextPaymentDate}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Auto-renewal scheduled</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* WITHDRAWAL ACTION BANNER FOR ADMINS */}
              {Array.isArray(selectedOrder.tags) && selectedOrder.tags.includes('Withdrawal Requested') && (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl space-y-3.5 text-left shadow-2xs">
                  <div className="flex items-center gap-2 text-rose-800">
                    <AlertTriangle className="h-4.5 w-4.5 text-rose-600 shrink-0 animate-pulse" />
                    <span className="font-extrabold text-xs uppercase tracking-wide">Customer Order Withdrawal Requested</span>
                  </div>
                  <p className="text-[11px] text-rose-700/90 leading-relaxed">
                    The customer has formally requested to withdraw items from this transaction. The transaction payment state has been provisionally flagged, and is awaiting physical approval or rejection by a store supervisor.
                  </p>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const updatedTags = selectedOrder.tags.filter(t => t !== 'Withdrawal Requested' && !t.startsWith('Withdraw:'));
                        updatedTags.push('Withdrawal Approved');
                        
                        const updatedOrders = parentOrders.map(o => {
                          if (o.id === selectedOrder.id) {
                            return {
                              ...o,
                              tags: updatedTags,
                              paymentStatus: 'Refunded' as const
                            };
                          }
                          return o;
                        });

                        const emailHtml = `
                          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; color: #334155;">
                            <div style="background-color: #10b981; padding: 25px 20px; text-align: center;">
                              <span style="font-size: 18px; font-weight: 900; color: #ffffff; letter-spacing: 2px;">POUCH SUPPLY</span>
                              <div style="font-size: 9px; font-weight: bold; color: #ecfdf5; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px;">WITHDRAWAL APPROVED</div>
                            </div>
                            
                            <div style="padding: 24px; text-align: left;">
                              <p style="font-size: 13px; font-weight: bold; color: #0f172a; margin-top: 0;">Dear ${selectedOrder.customerName || 'Value Member'},</p>
                              <p style="font-size: 12.5px; color: #475569; line-height: 1.6; margin-bottom: 20px;">
                                We are pleased to inform you that your withdrawal request for Order <strong>#${selectedOrder.id}</strong> has been <strong>approved</strong> by our store administrator.
                              </p>

                              <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 14px; margin-bottom: 20px; font-size: 11.5px; line-height: 1.5; color: #065f46;">
                                <strong>Refund Processed Successfully:</strong><br/>
                                The refund value has been processed back to your original payment card. It will typically clear into your account balance in 2-3 business banking days depending on your issuer.
                              </div>

                              <p style="font-size: 11.5px; color: #64748b; line-height: 1.5;">
                                If you require further assistance, please do not hesitate to reach out!
                              </p>
                            </div>
                            
                            <div style="background-color: #f8fafc; padding: 15px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 10px; color: #94a3b8;">
                              Thank you for choosing PouchSupply.
                            </div>
                          </div>
                        `;

                        const newEmail = {
                          to: selectedOrder.customerEmail,
                          subject: `Withdrawal APPROVED - Order #${selectedOrder.id}`,
                          preview: `Your withdrawal request for Order #${selectedOrder.id} has been approved. Refund processed.`,
                          body: emailHtml,
                          date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        };

                        fetch('/api/email/send-trigger', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            type: 'order_refunded',
                            recipient: selectedOrder.customerEmail,
                            data: { orderId: selectedOrder.id, customerName: selectedOrder.customerName }
                          })
                        }).catch(() => {});

                        parentOnUpdateOrders(updatedOrders);
                        setSelectedOrder({
                          ...selectedOrder,
                          tags: updatedTags,
                          paymentStatus: 'Refunded' as const
                        });
                      }}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[9.5px] tracking-wider rounded-lg text-center transition-colors cursor-pointer select-none border border-emerald-700"
                    >
                      Approve & Refund
                    </button>
                    
                    <button
                      onClick={() => {
                        const updatedTags = selectedOrder.tags.filter(t => t !== 'Withdrawal Requested' && !t.startsWith('Withdraw:'));
                        updatedTags.push('Withdrawal Declined');
                        
                        const updatedOrders = parentOrders.map(o => {
                          if (o.id === selectedOrder.id) {
                            return {
                              ...o,
                              tags: updatedTags,
                              paymentStatus: 'Paid' as const
                            };
                          }
                          return o;
                        });

                        const emailHtml = `
                          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; color: #334155;">
                            <div style="background-color: #ef4444; padding: 25px 20px; text-align: center;">
                              <span style="font-size: 18px; font-weight: 900; color: #ffffff; letter-spacing: 2px;">POUCH SUPPLY</span>
                              <div style="font-size: 9px; font-weight: bold; color: #fee2e2; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px;">WITHDRAWAL DECLINED</div>
                            </div>
                            
                            <div style="padding: 24px; text-align: left;">
                              <p style="font-size: 13px; font-weight: bold; color: #0f172a; margin-top: 0;">Hi ${selectedOrder.customerName || 'Value Member'},</p>
                              <p style="font-size: 12.5px; color: #475569; line-height: 1.6; margin-bottom: 20px;">
                                We are writing to update you regarding your withdrawal request for Order <strong>#${selectedOrder.id}</strong>.
                              </p>

                              <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 14px; margin-bottom: 20px; font-size: 11.5px; line-height: 1.5; color: #991b1b;">
                                <strong>Request Status: Declined</strong><br/>
                                Unfortunately, we were unable to complete your withdrawal request because the package containing your items has already been securely packed, labeled, and transferred to our postal partner for delivery. 
                              </div>

                              <p style="font-size: 11.5px; color: #64748b; line-height: 1.5;">
                                Once you receive the package, you are welcome to utilize our hassle-free returns policy to send any unwanted items back for a full refund.
                              </p>
                            </div>
                            
                            <div style="background-color: #f8fafc; padding: 15px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 10px; color: #94a3b8;">
                              Thank you for your understanding.
                            </div>
                          </div>
                        `;

                        const newEmail = {
                          to: selectedOrder.customerEmail,
                          subject: `Withdrawal Request Declined - Order #${selectedOrder.id}`,
                          preview: `Your withdrawal request for Order #${selectedOrder.id} was declined as the shipment has dispatched.`,
                          body: emailHtml,
                          date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        };

                        fetch('/api/email/send-trigger', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            type: 'order_processing',
                            recipient: selectedOrder.customerEmail,
                            data: { orderId: selectedOrder.id, customerName: selectedOrder.customerName }
                          })
                        }).catch(() => {});

                        parentOnUpdateOrders(updatedOrders);
                        setSelectedOrder({
                          ...selectedOrder,
                          tags: updatedTags,
                          paymentStatus: 'Paid' as const
                        });
                      }}
                      className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase text-[9.5px] tracking-wider rounded-lg text-center transition-colors cursor-pointer select-none border border-slate-750"
                    >
                      Decline Request
                    </button>
                  </div>
                </div>
              )}

              {/* FULFILLMENT CARD */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center text-xs border border-slate-200">
                      📦
                    </span>
                    <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">Fulfilled</span>
                    <span className="text-xs text-slate-400 font-semibold">#{selectedOrder.id}-F1</span>
                  </div>
                  <button className="text-slate-400 hover:text-slate-650 cursor-pointer">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>{selectedOrder.date || 'July 7, 2026'}</span>
                  </div>

                  {/* Order Items List */}
                  <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
                    {selectedOrder.items.map((item, idx) => {
                      const isKupanac = item.productTitle?.toLowerCase().includes('kupanac');
                      const variantLabel = (item as any).variant || (item as any).flavour || (item as any).strength || (isKupanac ? 'M / Green' : 'Standard');
                      const skuLabel = (item as any).sku || (isKupanac ? '010401015' : `SKU-${item.productId || idx + 1}`);
                      return (
                        <div key={idx} className="py-4 flex justify-between items-center gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center p-1 relative shrink-0">
                              <img
                                src={item.image || PLACEHOLDER_IMAGE}
                                alt={item.productTitle}
                                className="h-full object-contain filter drop-shadow-sm"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div>
                              <p className="font-extrabold text-xs text-slate-900 uppercase tracking-tight hover:text-indigo-600 transition-colors">
                                {item.productTitle}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-slate-405 font-bold mt-0.5">
                                <span>{variantLabel}</span>
                                <span>•</span>
                                <span>{skuLabel}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-xs font-black text-slate-900">£{(Number((item.price || 0) * (item.quantity || 1))).toFixed(2)}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-0.5">£{(Number(item.price) || 0).toFixed(2)} × {item.quantity || 1}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Royal Mail Click & Drop Integration Section */}
                  <RoyalMailOrderActions
                    order={selectedOrder}
                    onUpdateOrder={(updated) => {
                      setSelectedOrder(updated);
                      const updatedOrders = parentOrders.map(o => String(o.id) === String(updated.id) ? updated : o);
                      parentOnUpdateOrders(updatedOrders);
                    }}
                    onAddTimelineComment={(text) => {
                      setTimelineComments(prev => ({
                        ...prev,
                        [selectedOrder.id]: [
                          ...(prev[selectedOrder.id] || []),
                          { text, date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
                        ]
                      }));
                    }}
                  />

                  {/* Manual Tracking Section Fallback */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Other Carrier / Manual Tracking</span>
                      <div className="flex items-center gap-2 mt-1">
                        <Truck className="h-4 w-4 text-slate-600" />
                        <span className="text-xs font-extrabold text-slate-800">
                          {selectedOrder.carrier || 'Royal Mail'} {selectedOrder.trackingId ? `- ${selectedOrder.trackingId}` : '(No tracking yet)'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setTrackingNumberInput(selectedOrder.trackingId || '');
                        setCarrierInput(selectedOrder.carrier || 'Royal Mail Tracked 24');
                        setShowTrackingModal(true);
                      }}
                      className="py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs rounded-lg transition-all shadow-3xs cursor-pointer select-none"
                    >
                      {selectedOrder.trackingId ? 'Edit Manual Tracking' : 'Add Manual Tracking'}
                    </button>
                  </div>

                </div>
              </div>

              {/* PAYMENT DETAILS CARD */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 uppercase tracking-wide">Payment Details</span>
                    <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase">
                      {selectedOrder.paymentStatus || 'Paid'}
                    </span>
                  </div>
                  <span className="text-xs font-extrabold text-slate-900">£{(Number(selectedOrder.total) || 0).toFixed(2)}</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal ({selectedOrder.items ? selectedOrder.items.length : 0} items)</span>
                    <span className="font-extrabold text-slate-800">£{(Number(selectedOrder.total) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Shipping (Royal Mail)</span>
                    <span className="font-extrabold text-slate-800">£0.00</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-100">
                    <span>Total Paid</span>
                    <span>£{(Number(selectedOrder.total) || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* TIMELINE & COMMENTS */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-900 tracking-wide border-b border-slate-100 pb-3">Order Activity Timeline</h3>
                
                {/* Comment Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    id={`timeline-input-${selectedOrder.id}`}
                    placeholder="Leave a note or comment on this order..."
                    className="flex-1 text-xs border border-slate-200 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        const text = e.currentTarget.value.trim();
                        setTimelineComments(prev => ({
                          ...prev,
                          [selectedOrder.id]: [{ text, date: 'Just now' }, ...(prev[selectedOrder.id] || [])]
                        }));
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById(`timeline-input-${selectedOrder.id}`) as HTMLInputElement;
                      if (input && input.value.trim()) {
                        const text = input.value.trim();
                        setTimelineComments(prev => ({
                          ...prev,
                          [selectedOrder.id]: [{ text, date: 'Just now' }, ...(prev[selectedOrder.id] || [])]
                        }));
                        input.value = '';
                      }
                    }}
                    className="py-2 px-3 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition cursor-pointer flex items-center gap-1"
                  >
                    <Send className="h-3 w-3" /> Post
                  </button>
                </div>

                {/* Timeline List */}
                <div className="space-y-3 pt-2">
                  {(timelineComments[selectedOrder.id] || []).map((c, i) => (
                    <div key={i} className="flex gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-150">
                      <MessageSquare className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-slate-800">{c.text}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{c.date}</p>
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-3 text-xs text-slate-500 items-start">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                    <div>
                      <p className="font-semibold text-slate-700">Order #{selectedOrder.id} placed by {selectedOrder.customerName}</p>
                      <p className="text-[10px] text-slate-400">{selectedOrder.date}</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column (Customer Profile Details) */}
            <div className="space-y-6">
              
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
                <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase text-slate-900 tracking-wide">Customer Details</h3>
                  <button className="text-indigo-600 font-bold text-xs hover:underline cursor-pointer">Edit</button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <p className="font-black text-slate-900">{selectedOrder.customerName}</p>
                    <p className="text-indigo-600 font-bold hover:underline cursor-pointer">{selectedOrder.customerEmail}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Shipping Address</p>
                    <p className="font-bold text-slate-800">{selectedOrder.customerName}</p>
                    <p className="text-slate-600">124 High Street, Suite 4B</p>
                    <p className="text-slate-600">London, EC1A 1BB</p>
                    <p className="text-slate-600">United Kingdom</p>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {(selectedOrder.tags || ['VIP', 'UK Retail']).map((t, idx) => (
                        <span key={idx} className="bg-slate-100 text-slate-700 font-bold text-[10px] px-2 py-0.5 rounded-md border border-slate-200">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* EDIT TRACKING MODAL */}
          {showTrackingModal && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-2xl animate-scale">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                  <h3 className="font-black text-slate-900 text-sm">Update Shipment Tracking</h3>
                  <button onClick={() => setShowTrackingModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer text-xs font-bold">✕</button>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider text-[9.5px] mb-1">Tracking Number</label>
                    <input
                      type="text"
                      value={trackingNumberInput}
                      onChange={(e) => setTrackingNumberInput(e.target.value)}
                      placeholder="e.g. TH829301928GB"
                      className="w-full border border-slate-200 p-2.5 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider text-[9.5px] mb-1">Carrier Name</label>
                    <input
                      type="text"
                      value={carrierInput}
                      onChange={(e) => setCarrierInput(e.target.value)}
                      placeholder="e.g. Royal Mail Tracked 24"
                      className="w-full border border-slate-200 p-2.5 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-500"
                    />
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowTrackingModal(false)}
                    className="py-2 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-all shadow-3xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (selectedOrder) {
                        const updated = {
                          ...selectedOrder,
                          trackingId: trackingNumberInput,
                          carrier: carrierInput,
                          fulfillmentStatus: 'Fulfilled' as const
                        };
                        const updatedOrders = parentOrders.map(o => o.id === selectedOrder.id ? updated : o);
                        parentOnUpdateOrders(updatedOrders);
                        setSelectedOrder(updated);
                        setShowTrackingModal(false);

                        const trackingComment = `Added tracking details: ${carrierInput} (${trackingNumberInput}).`;
                        setTimelineComments(prev => ({
                          ...prev,
                          [selectedOrder.id]: [{ text: trackingComment, date: 'Just now' }, ...(prev[selectedOrder.id] || [])]
                        }));
                      }
                    }}
                    className="py-2 px-4 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-black rounded-lg cursor-pointer transition-all shadow-2xs uppercase tracking-widest"
                  >
                    Save
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};

export default OrdersTab;

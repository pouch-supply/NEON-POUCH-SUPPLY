import React from 'react';
import { Search, Download, Upload, Plus } from 'lucide-react';

interface CustomerItem {
  id: string;
  name: string;
  email: string;
  location: string;
  subscriptionStatus: 'Subscribed' | 'Not subscribed' | 'Unsubscribed';
  ordersCount: number;
  amountSpent: number;
}

interface CustomersTabProps {
  customerQuery: string;
  setCustomerQuery: (val: string) => void;
  handleExportCustomers: () => void;
  handleImportCustomers: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setShowAddCustomer: (val: boolean) => void;
  filteredCustomers: CustomerItem[];
  showAddCustomer: boolean;
  handleAddCustomerSubmit: (e: React.FormEvent) => void;
  newCustomerForm: { name: string; email: string; location: string; subscriptionStatus: 'Subscribed' | 'Not subscribed' | 'Unsubscribed' };
  setNewCustomerForm: React.Dispatch<React.SetStateAction<{ name: string; email: string; location: string; subscriptionStatus: 'Subscribed' | 'Not subscribed' | 'Unsubscribed' }>>;
}

export const CustomersTab: React.FC<CustomersTabProps> = ({
  customerQuery,
  setCustomerQuery,
  handleExportCustomers,
  handleImportCustomers,
  setShowAddCustomer,
  filteredCustomers,
  showAddCustomer,
  handleAddCustomerSubmit,
  newCustomerForm,
  setNewCustomerForm
}) => {
  return (
    <div className="space-y-6">
      
      {/* Header control toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Filter client files, names..."
            value={customerQuery}
            onChange={(e) => setCustomerQuery(e.target.value)}
            className="w-full text-xs p-2 pb-2 pl-8 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-500 bg-slate-50"
          />
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCustomers}
            className="bg-white hover:bg-slate-50 border border-slate-200 font-bold p-2.5 px-3 rounded-xl text-xs text-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            title="Export all customers to JSON backup file"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" /> Export Backup
          </button>

          <label
            className="bg-white hover:bg-slate-50 border border-slate-200 font-bold p-2.5 px-3 rounded-xl text-xs text-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-2xs cursor-pointer"
            title="Import customers from JSON backup"
          >
            <Upload className="h-3.5 w-3.5 text-slate-500" /> Import Backup
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportCustomers}
            />
          </label>

          <button
            onClick={() => setShowAddCustomer(true)}
            className="bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs p-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Register Customer Profile
          </button>
        </div>
      </div>

      {/* Customers details list */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[10px] text-slate-450 font-bold uppercase tracking-widest">
                <th className="p-4">Customer Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Delivery Location</th>
                <th className="p-4 text-center">Subscription Status</th>
                <th className="p-4 text-center">Total Orders Count</th>
                <th className="p-4 text-right font-sans">Total Spent Amount</th>
                <th className="p-4 text-center">Reference profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">No Customers configured on store directory.</td>
                </tr>
              ) : (
                filteredCustomers.map(cust => (
                  <tr key={cust.id} className="hover:bg-slate-50/50">
                    <td className="p-4 font-black text-slate-900">{cust.name}</td>
                    <td className="p-4 text-slate-500">{cust.email}</td>
                    <td className="p-4 text-slate-700">{cust.location}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-block py-0.5 px-2 rounded-full font-bold text-[9px] uppercase tracking-wider ${
                        cust.subscriptionStatus === 'Subscribed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {cust.subscriptionStatus}
                      </span>
                    </td>
                    <td className="p-4 text-center font-bold text-slate-800">{cust.ordersCount} buys</td>
                    <td className="p-4 text-right font-extrabold text-slate-950">£{cust.amountSpent.toFixed(2)}</td>
                    <td className="p-4 text-center font-bold text-[10px] text-slate-400 uppercase">Registered</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
      {showAddCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-sm w-full shadow-2xl animate-scale">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-slate-800 text-sm">Register Custom Client Profile</h3>
              <button onClick={() => setShowAddCustomer(false)} className="text-slate-400 hover:text-slate-650 cursor-pointer text-xs font-bold">Close</button>
            </div>

            <form onSubmit={handleAddCustomerSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-600 uppercase tracking-widest text-[9px] mb-1">Full Name</label>
                <input
                  id="cust-form-name"
                  type="text"
                  required
                  placeholder="e.g. Sandra Kaneshiro"
                  value={newCustomerForm.name}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                  className="w-full border p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 uppercase tracking-widest text-[9px] mb-1">Email Address</label>
                <input
                  id="cust-form-email"
                  type="email"
                  required
                  placeholder="e.g. sandra.k@gmail.com"
                  value={newCustomerForm.email}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                  className="w-full border p-2.5 rounded-lg focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 uppercase tracking-widest text-[9px] mb-1">Delivery address country</label>
                <input
                  id="cust-form-loc"
                  type="text"
                  placeholder="e.g. Honolulu HI, United States"
                  value={newCustomerForm.location}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, location: e.target.value })}
                  className="w-full border p-2.5 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 uppercase tracking-widest text-[9px] mb-1">Subscription plan status</label>
                <select
                  id="cust-form-subs"
                  value={newCustomerForm.subscriptionStatus}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, subscriptionStatus: e.target.value as any })}
                  className="w-full border p-2.5 rounded-lg focus:outline-none"
                >
                  <option value="Subscribed">Subscribed (Active Plans)</option>
                  <option value="Not subscribed">Not subscribed</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg cursor-pointer"
              >
                Publish Client Record
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default CustomersTab;

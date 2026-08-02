// Initialize Supabase
const SUPABASE_URL = 'https://ueexdcojxjsevwfjbsmp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlZXhkY29qeGpzZXZ3Zmpic21wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MjAxOTcsImV4cCI6MjEwMTE5NjE5N30.glSXDNgb38D8puPQa5GHzkcrb-R7vpXqM3H9v5KGmhU';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const audioSound = document.getElementById('orderNotificationSound');
let orders = [];

document.addEventListener('DOMContentLoaded', () => {
  fetchOrders();
  listenToRealtimeOrders();

  // Enable audio context on first user click (browsers require user interaction to allow auto-play)
  document.body.addEventListener('click', () => {
    if (audioSound) {
      audioSound.load();
    }
  }, { once: true });
});

// 1. Fetch Orders from Database
async function fetchOrders() {
  const { data, error } = await supabaseClient
    .from('orders')
    .select(`
      *,
      order_items (
        id,
        quantity,
        unit_price,
        menu_items ( name )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }

  orders = data;
  renderOrders();
  checkUnattendedOrders();
}

// 2. Real-Time Listener (Auto-Refresh & Sound Alert)
function listenToRealtimeOrders() {
  supabaseClient
    .channel('public:orders')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
      console.log(' New order received!', payload);
      
      // Play continuous alert sound
      playOrderSound();

      // Refresh orders list immediately
      fetchOrders();
    })
    .subscribe();
}

// Sound Control Functions
function playOrderSound() {
  if (audioSound) {
    audioSound.currentTime = 0;
    audioSound.play().catch(err => console.log('Autoplay prevented by browser:', err));
  }
}

function stopOrderSound() {
  if (audioSound) {
    audioSound.pause();
    audioSound.currentTime = 0;
  }
}

function checkUnattendedOrders() {
  const hasPending = orders.some(o => o.status === 'pending');
  if (!hasPending) {
    stopOrderSound();
  }
}

// 3. Render Orders in Admin UI
function renderOrders() {
  const ordersContainer = document.getElementById('ordersContainer');
  if (!ordersContainer) return;

  if (orders.length === 0) {
    ordersContainer.innerHTML = `<p class="text-gray-500 text-center py-10">No orders received yet.</p>`;
    return;
  }

  ordersContainer.innerHTML = orders.map(order => {
    const isPending = order.status === 'pending';
    const dateFormatted = new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const itemsList = order.order_items ? order.order_items.map(item => `
      <div class="text-xs text-gray-700 flex justify-between py-1 border-b border-gray-50">
        <span>${item.quantity}x ${item.menu_items ? item.menu_items.name : 'Custom Item'}</span>
        <span class="font-bold">₦${(item.unit_price * item.quantity).toLocaleString()}</span>
      </div>
    `).join('') : '<p class="text-xs text-gray-400">No items listed</p>';

    return `
      <div class="bg-white rounded-xl shadow-md border-2 ${isPending ? 'border-red-500 animate-pulse' : 'border-gray-100'} p-5 transition">
        <div class="flex justify-between items-center mb-3">
          <span class="text-xs font-bold px-2.5 py-1 rounded-full ${isPending ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} uppercase">
            ${order.status || 'Pending'}
          </span>
          <span class="text-xs text-gray-400 font-semibold">${dateFormatted}</span>
        </div>

        <h4 class="font-extrabold text-gray-900 text-base">${order.customer_name}</h4>
        <p class="text-xs text-gray-500 font-medium">📞 ${order.customer_phone}</p>
        <p class="text-xs text-gray-500 mb-4">📍 ${order.delivery_address}</p>

        <div class="bg-gray-50 p-3 rounded-lg mb-4">
          ${itemsList}
        </div>

        <div class="flex justify-between items-center pt-2 border-t border-gray-100 mb-4">
          <span class="text-xs text-gray-500 font-bold">Total Amount:</span>
          <span class="text-lg font-black text-red-700">₦${Number(order.total_amount).toLocaleString()}</span>
        </div>

        ${isPending ? `
          <button onclick="acceptOrder('${order.id}')" class="w-full bg-red-700 hover:bg-red-800 text-white text-sm font-bold py-2.5 rounded-lg transition shadow flex items-center justify-center space-x-2">
            <span>🔔 Accept & Silence Alarm</span>
          </button>
        ` : `
          <button disabled class="w-full bg-gray-200 text-gray-500 text-xs font-bold py-2 rounded-lg cursor-not-allowed">
            ✓ Accepted
          </button>
        `}
      </div>
    `;
  }).join('');
}

// 4. Accept Order & Silence Alarm
window.acceptOrder = async function(orderId) {
  const { error } = await supabaseClient
    .from('orders')
    .update({ status: 'accepted' })
    .eq('id', orderId);

  if (error) {
    alert('Failed to update order status.');
    console.error(error);
    return;
  }

  // Silence chime if no other pending orders exist
  stopOrderSound();
  fetchOrders();
};

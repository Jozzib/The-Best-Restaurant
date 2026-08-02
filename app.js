// 1. Initialize Supabase
const SUPABASE_URL = 'https://ueexdcojxjsevwfjbsmp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlZXhkY29qeGpzZXZ3Zmpic21wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MjAxOTcsImV4cCI6MjEwMTE5NjE5N30.glSXDNgb38D8puPQa5GHzkcrb-R7vpXqM3H9v5KGmhU'; 

// !!! RESTAURANT WHATSAPP NUMBER !!!
const RESTAURANT_WHATSAPP_NUMBER = '2348023467011'; 

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State variables
let menuItems = [];
let categories = [];
let cart = [];
let selectedCategory = 'all';

// Customization Modal State
let activeItemForCustomization = null;
let modalMeatQty = 1;
let modalExtraSwallowQty = 0;

// DOM Elements
const menuGrid = document.getElementById('menuGrid');
const categoryContainer = document.getElementById('categoryContainer');
const cartBtn = document.getElementById('cartBtn');
const closeCartBtn = document.getElementById('closeCartBtn');
const cartDrawer = document.getElementById('cartDrawer');
const cartItemsContainer = document.getElementById('cartItems');
const cartCountEl = document.getElementById('cartCount');
const cartTotalEl = document.getElementById('cartTotal');
const cartFooter = document.getElementById('cartFooter');
const checkoutForm = document.getElementById('checkoutForm');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  fetchCategories();
  fetchMenuItems();

  // Event listeners for Customization Modal inputs to recalculate totals
  const meatTypeSelect = document.getElementById('selectMeatType');
  const extraSwallowSelect = document.getElementById('selectExtraSwallowType');
  const modalAddToCartBtn = document.getElementById('modalAddToCartBtn');

  if (meatTypeSelect) meatTypeSelect.addEventListener('change', calculateModalTotal);
  if (extraSwallowSelect) extraSwallowSelect.addEventListener('change', calculateModalTotal);
  if (modalAddToCartBtn) modalAddToCartBtn.addEventListener('click', confirmCustomizationAndAddToCart);
});

// Fetch Categories from Supabase
async function fetchCategories() {
  const { data, error } = await supabaseClient.from('categories').select('*');
  if (error) {
    console.error('Error fetching categories:', error);
    return;
  }
  categories = data;
  renderCategories();
}

// Fetch Menu Items from Supabase
async function fetchMenuItems() {
  const { data, error } = await supabaseClient.from('menu_items').select('*').eq('is_available', true);
  if (error) {
    console.error('Error fetching menu items:', error);
    menuGrid.innerHTML = `<p class="text-red-500 col-span-full text-center py-10">Failed to load menu items.</p>`;
    return;
  }
  menuItems = data;
  renderMenu();
}

// Render Category Buttons
function renderCategories() {
  const categoryHtml = categories.map(cat => `
    <button 
      onclick="filterCategory('${cat.id}')" 
      class="cat-btn px-4 py-2 bg-gray-200 hover:bg-red-600 hover:text-white rounded-full font-semibold text-sm transition whitespace-nowrap"
      data-id="${cat.id}"
    >
      ${cat.name}
    </button>
  `).join('');

  categoryContainer.innerHTML = `
    <button onclick="filterCategory('all')" class="cat-btn px-4 py-2 bg-red-700 text-white rounded-full font-semibold text-sm transition whitespace-nowrap active-category" data-id="all">
      All Items
    </button>
  ` + categoryHtml;
}

// Filter Menu by Category
window.filterCategory = function(catId) {
  selectedCategory = catId;
  
  document.querySelectorAll('.cat-btn').forEach(btn => {
    if (btn.getAttribute('data-id') === catId) {
      btn.className = "cat-btn px-4 py-2 bg-red-700 text-white rounded-full font-semibold text-sm transition whitespace-nowrap active-category";
    } else {
      btn.className = "cat-btn px-4 py-2 bg-gray-200 hover:bg-red-600 hover:text-white rounded-full font-semibold text-sm transition whitespace-nowrap";
    }
  });

  renderMenu();
};

// Render Menu Items
function renderMenu() {
  const filtered = selectedCategory === 'all' 
    ? menuItems 
    : menuItems.filter(item => item.category_id === selectedCategory);

  if (filtered.length === 0) {
    menuGrid.innerHTML = `<p class="text-gray-500 col-span-full text-center py-10">No items available in this category.</p>`;
    return;
  }

  menuGrid.innerHTML = filtered.map(item => `
    <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition flex flex-col justify-between border border-gray-100">
      <img src="${item.image_url || 'https://via.placeholder.com/300'}" alt="${item.name}" class="w-full h-48 object-cover">
      <div class="p-4 flex-grow flex flex-col justify-between">
        <div>
          <h3 class="font-bold text-lg text-gray-800">${item.name}</h3>
          <p class="text-gray-500 text-sm mt-1 mb-3 line-clamp-2">${item.description || ''}</p>
        </div>
        <div class="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <span class="font-black text-red-700 text-lg">₦${Number(item.price).toLocaleString()}</span>
          <button onclick="handleAddToCartClick('${item.id}')" class="bg-red-700 hover:bg-red-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition shadow-sm active:scale-95">
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// Handle Add To Cart Button Click (Route to Modal or Direct Add)
window.handleAddToCartClick = function(itemId) {
  const item = menuItems.find(i => i.id === itemId);
  if (!item) return;

  const itemNameLower = item.name.toLowerCase();
  const isCustomizable = itemNameLower.includes('soup') || itemNameLower.includes('swallow') || itemNameLower.includes('yam') || itemNameLower.includes('egusi') || itemNameLower.includes('amala') || itemNameLower.includes('eba') || itemNameLower.includes('semo');

  if (isCustomizable) {
    openCustomizeModal(item);
  } else {
    // Add simple item directly
    addItemToCartArray({
      id: item.id + '_std',
      menu_item_id: item.id,
      name: item.name,
      price: Number(item.price),
      details: '',
      quantity: 1
    });
  }
};

// Open Customization Modal
function openCustomizeModal(item) {
  activeItemForCustomization = item;
  modalMeatQty = 1;
  modalExtraSwallowQty = 0;

  document.getElementById('modalMealTitle').innerText = item.name;
  document.getElementById('modalMealBasePrice').innerText = `Base Price: ₦${Number(item.price).toLocaleString()}`;
  document.getElementById('modalMeatQty').innerText = modalMeatQty;
  document.getElementById('modalExtraSwallowQty').innerText = modalExtraSwallowQty;

  calculateModalTotal();
  document.getElementById('customizeModal').classList.remove('hidden');
}

window.closeCustomizeModal = function() {
  document.getElementById('customizeModal').classList.add('hidden');
  activeItemForCustomization = null;
};

window.adjustModalQty = function(type, change) {
  if (type === 'meat') {
    modalMeatQty = Math.max(1, modalMeatQty + change);
    document.getElementById('modalMeatQty').innerText = modalMeatQty;
  } else if (type === 'extraSwallow') {
    modalExtraSwallowQty = Math.max(0, modalExtraSwallowQty + change);
    document.getElementById('modalExtraSwallowQty').innerText = modalExtraSwallowQty;
  }
  calculateModalTotal();
};

function calculateModalTotal() {
  if (!activeItemForCustomization) return 0;

  const basePrice = Number(activeItemForCustomization.price);
  const meatSelect = document.getElementById('selectMeatType');
  const meatUnitPrice = Number(meatSelect.options[meatSelect.selectedIndex].getAttribute('data-price') || 0);
  const totalMeatPrice = meatUnitPrice * modalMeatQty;

  const extraSwallowPrice = modalExtraSwallowQty * 500;
  const calculatedTotal = basePrice + totalMeatPrice + extraSwallowPrice;

  document.getElementById('modalCalculatedTotal').innerText = `₦${calculatedTotal.toLocaleString()}`;
  return calculatedTotal;
}

function confirmCustomizationAndAddToCart() {
  if (!activeItemForCustomization) return;

  const swallow = document.getElementById('selectSwallow').value;
  const soup = document.getElementById('selectSoup').value;
  const meatSelect = document.getElementById('selectMeatType');
  const meatType = meatSelect.value;
  const extraSwallowType = document.getElementById('selectExtraSwallowType').value;

  const calculatedPrice = calculateModalTotal();

  let detailsArray = [
    `Swallow: ${swallow}`,
    `Soup: ${soup}`,
    `Meat: ${modalMeatQty}x ${meatType}`
  ];

  if (modalExtraSwallowQty > 0) {
    detailsArray.push(`Extra: ${modalExtraSwallowQty}x ${extraSwallowType}`);
  }

  const detailsString = detailsArray.join(' | ');
  const cartItemId = `${activeItemForCustomization.id}_${swallow}_${soup}_${meatType}_${modalMeatQty}_${modalExtraSwallowQty}`;

  addItemToCartArray({
    id: cartItemId,
    menu_item_id: activeItemForCustomization.id,
    name: activeItemForCustomization.name,
    price: calculatedPrice,
    details: detailsString,
    quantity: 1
  });

  closeCustomizeModal();
}

function addItemToCartArray(newItem) {
  const existing = cart.find(i => i.id === newItem.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push(newItem);
  }

  updateCartUI();

  if (cartBtn) {
    cartBtn.classList.add('scale-110');
    setTimeout(() => cartBtn.classList.remove('scale-110'), 200);
  }
}

window.updateQuantity = function(cartItemId, change) {
  const index = cart.findIndex(i => i.id === cartItemId);
  if (index !== -1) {
    cart[index].quantity += change;
    if (cart[index].quantity <= 0) {
      cart.splice(index, 1);
    }
  }
  updateCartUI();
};

function updateCartUI() {
  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  cartCountEl.textContent = totalCount;
  cartTotalEl.textContent = `₦${totalPrice.toLocaleString()}`;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `<p class="text-gray-500 text-center py-6">Your cart is empty.</p>`;
    cartFooter.classList.add('hidden');
  } else {
    cartFooter.classList.remove('hidden');
    cartItemsContainer.innerHTML = cart.map(item => `
      <div class="flex items-center justify-between border-b pb-3">
        <div>
          <h4 class="font-bold text-sm text-gray-800">${item.name}</h4>
          ${item.details ? `<p class="text-xs text-red-700 font-medium leading-tight my-0.5">${item.details}</p>` : ''}
          <p class="text-xs text-gray-500">₦${Number(item.price).toLocaleString()} x ${item.quantity}</p>
        </div>
        <div class="flex items-center space-x-2">
          <button onclick="updateQuantity('${item.id}', -1)" class="w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded text-xs font-bold">-</button>
          <span class="text-sm font-semibold">${item.quantity}</span>
          <button onclick="updateQuantity('${item.id}', 1)" class="w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded text-xs font-bold">+</button>
        </div>
      </div>
    `).join('');
  }
}

// Toggle Cart Drawer
function toggleCart(open) {
  if (open) {
    cartDrawer.classList.remove('hidden');
  } else {
    cartDrawer.classList.add('hidden');
  }
}

cartBtn.addEventListener('click', () => toggleCart(true));
closeCartBtn.addEventListener('click', () => toggleCart(false));

// Handle Checkout Submission
checkoutForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('custName').value;
  const phone = document.getElementById('custPhone').value;
  const address = document.getElementById('custAddress').value;
  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // 1. Insert Order into Supabase
  const { data: order, error: orderError } = await supabaseClient
    .from('orders')
    .insert([{ customer_name: name, customer_phone: phone, delivery_address: address, total_amount: totalAmount }])
    .select()
    .single();

  if (orderError) {
    alert('Failed to place order. Please try again.');
    console.error(orderError);
    return;
  }

  // 2. Insert Order Items
  const orderItemsData = cart.map(item => ({
    order_id: order.id,
    menu_item_id: item.menu_item_id,
    quantity: item.quantity,
    unit_price: item.price
  }));

  const { error: itemsError } = await supabaseClient.from('order_items').insert(orderItemsData);

  if (itemsError) {
    console.error('Error adding order items:', itemsError);
  }

  // 3. Format WhatsApp Message
  let itemListText = cart.map(i => {
    let text = `• *${i.name}* (x${i.quantity}) - ₦${(i.price * i.quantity).toLocaleString()}`;
    if (i.details) {
      text += `\n   └ _${i.details}_`;
    }
    return text;
  }).join('\n');
  
  const whatsappMessage = 
`🚨 *NEW ORDER RECEIVED!* 🚨
--------------------------------
*Customer:* ${name}
*Phone:* ${phone}
*Delivery Address:* ${address}

*Order Breakdown:*
${itemListText}

--------------------------------
*TOTAL AMOUNT:* ₦${totalAmount.toLocaleString()}
--------------------------------
Please confirm and start preparing!`;

  const encodedMessage = encodeURIComponent(whatsappMessage);
  const whatsappUrl = `https://wa.me/${RESTAURANT_WHATSAPP_NUMBER}?text=${encodedMessage}`;

  alert(`Thank you, ${name}! Your order has been placed. Click OK to send your full order details directly to our kitchen on WhatsApp!`);

  // Reset local state
  cart = [];
  updateCartUI();
  toggleCart(false);
  checkoutForm.reset();

  // Redirect to WhatsApp
  window.location.href = whatsappUrl;
});

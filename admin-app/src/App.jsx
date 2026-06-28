import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import './App.css';

// Extract Facebook username/ID for Messenger links
function extract_username(facebookUrl) {
  if (!facebookUrl) return '';
  const trimmed = facebookUrl.trim();
  if (!trimmed.includes('/') && !trimmed.includes('.')) {
    return trimmed;
  }
  try {
    let cleaned = trimmed.replace(/^(https?:\/\/)?(www\.)?((m|touch|web)\.)?facebook\.com\//i, '');
    if (cleaned.includes('profile.php')) {
      const match = cleaned.match(/id=(\d+)/);
      if (match) return match[1];
    }
    cleaned = cleaned.split('/')[0].split('?')[0];
    return cleaned.trim();
  } catch (e) {
    return trimmed;
  }
}

// Initial Mock Data for testing
const INITIAL_MOCK_PRODUCTS = [
  {
    id: 'a3d2e1b1-2e6f-4c12-9db8-17a42a59a901',
    name: 'iPhone 15 Pro Max 256GB',
    price: 30990000,
    description: 'Thiết kế titan bền bỉ, chip A17 Pro mạnh mẽ vượt trội.',
    image_url: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?q=80&w=600&auto=format&fit=cover',
    stock: 8,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 'b4e3d2c2-3f7a-4d23-ad99-28b53b60b012',
    name: 'MacBook Pro 14" M3 Pro',
    price: 49990000,
    description: 'Hiệu năng đồ họa đỉnh cao với chip M3 Pro, Liquid Retina XDR.',
    image_url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=600&auto=format&fit=cover',
    stock: 5,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'c5f4e3d3-4a8b-4e34-be00-39c64c71c123',
    name: 'AirPods Pro 2 USB-C',
    price: 5790000,
    description: 'Chủ động khử tiếng ồn gấp 2 lần, hộp sạc USB-C.',
    image_url: 'https://images.unsplash.com/photo-1588449668365-d15e397f6787?q=80&w=600&auto=format&fit=cover',
    stock: 15,
    created_at: new Date(Date.now() - 86400000 * 1).toISOString()
  }
];

const INITIAL_MOCK_ORDERS = [
  {
    id: 'ord-9821a-42c1',
    customer_name: 'Nguyễn Trần Chi Tùng',
    phone: '0987654321',
    facebook_url: 'https://facebook.com/chi.tung.99',
    address: '123 Đường Lê Lợi, Quận 1, TP. Hồ Chí Minh',
    total_price: 36780000,
    status: 'pending',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString() // 2 hours ago
  },
  {
    id: 'ord-7612f-98d1',
    customer_name: 'Trần Thị B',
    phone: '0912345678',
    facebook_url: 'tran.b.fb',
    address: '456 Đường Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
    total_price: 49990000,
    status: 'completed',
    created_at: new Date(Date.now() - 86400000 * 1).toISOString() // 1 day ago
  }
];

const INITIAL_MOCK_ORDER_ITEMS = [
  { id: 1, order_id: 'ord-9821a-42c1', product_id: 'a3d2e1b1-2e6f-4c12-9db8-17a42a59a901', quantity: 1, price: 30990000, product_name: 'iPhone 15 Pro Max 256GB' },
  { id: 2, order_id: 'ord-9821a-42c1', product_id: 'c5f4e3d3-4a8b-4e34-be00-39c64c71c123', quantity: 1, price: 5790000, product_name: 'AirPods Pro 2 USB-C' },
  { id: 3, order_id: 'ord-7612f-98d1', product_id: 'b4e3d2c2-3f7a-4d23-ad99-28b53b60b012', quantity: 1, price: 49990000, product_name: 'MacBook Pro 14" M3 Pro' }
];

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  
  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Mode: true if Supabase URL is placeholder
  const [isMockMode, setIsMockMode] = useState(false);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  // App States
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // CRUD Forms Modal States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // null = add new, object = editing
  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    stock: '',
    description: '',
    image_url: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [savingProduct, setSavingProduct] = useState(false);

  // Order Details Modal
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Real-time alert state
  const [newOrderAlert, setNewOrderAlert] = useState(null);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const isPlaceholderUrl = supabase.supabaseUrl.includes('your-supabase-url');
    setIsMockMode(isPlaceholderUrl);

    if (isPlaceholderUrl) {
      // Offline/Mock mode
      const savedSession = localStorage.getItem('vipi_admin_session');
      if (savedSession) {
        setSession(JSON.parse(savedSession));
      }
      setLoadingSession(false);
      return;
    }

    try {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);

      // Listen for auth state changes
      supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
      });
    } catch (e) {
      console.warn("Auth error, fallback to local session check", e);
    } finally {
      setLoadingSession(false);
    }
  };

  // Fetch data depending on activeTab
  useEffect(() => {
    if (session) {
      loadAllData();
    }
  }, [session]);

  // Real-time listener for orders
  useEffect(() => {
    if (session && !isMockMode) {
      const channel = supabase
        .channel('public:orders')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'orders' },
          (payload) => {
            console.log('Real-time order received:', payload.new);
            const newOrder = payload.new;
            // Add to orders list
            setOrders(prev => [newOrder, ...prev]);
            // Show notification toast
            setNewOrderAlert(newOrder);
            setTimeout(() => setNewOrderAlert(null), 8000);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [session, isMockMode]);

  const loadAllData = async () => {
    setLoadingData(true);
    if (isMockMode) {
      // Load from LocalStorage or initialize with mock data
      const savedProducts = localStorage.getItem('vipi_products');
      const savedOrders = localStorage.getItem('vipi_orders');
      const savedOrderItems = localStorage.getItem('vipi_order_items');

      if (savedProducts) setProducts(JSON.parse(savedProducts));
      else {
        setProducts(INITIAL_MOCK_PRODUCTS);
        localStorage.setItem('vipi_products', JSON.stringify(INITIAL_MOCK_PRODUCTS));
      }

      if (savedOrders) setOrders(JSON.parse(savedOrders));
      else {
        setOrders(INITIAL_MOCK_ORDERS);
        localStorage.setItem('vipi_orders', JSON.stringify(INITIAL_MOCK_ORDERS));
      }

      if (savedOrderItems) setOrderItems(JSON.parse(savedOrderItems));
      else {
        setOrderItems(INITIAL_MOCK_ORDER_ITEMS);
        localStorage.setItem('vipi_order_items', JSON.stringify(INITIAL_MOCK_ORDER_ITEMS));
      }
      setLoadingData(false);
      return;
    }

    try {
      // Fetch all data in parallel to reduce loading latency (concurrency)
      const [prodRes, ordRes, itemsRes] = await Promise.all([
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('order_items').select('*, products(name)')
      ]);

      if (prodRes.error) throw prodRes.error;
      if (ordRes.error) throw ordRes.error;
      if (itemsRes.error) throw itemsRes.error;

      setProducts(prodRes.data || []);
      setOrders(ordRes.data || []);

      const mappedItems = (itemsRes.data || []).map(item => ({
        ...item,
        product_name: item.products ? item.products.name : 'Sản phẩm đã bị xóa'
      }));
      setOrderItems(mappedItems);
    } catch (error) {
      console.error("Error loading Supabase data:", error.message);
    } finally {
      setLoadingData(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (isMockMode) {
      // Mock login bypass
      if (loginEmail === 'admin@vipi.vn' && loginPassword === 'admin123') {
        const mockUser = { email: loginEmail, role: 'admin' };
        const mockSession = { user: mockUser, access_token: 'mock-token' };
        setSession(mockSession);
        localStorage.setItem('vipi_admin_session', JSON.stringify(mockSession));
      } else {
        setAuthError('Sai tài khoản hoặc mật khẩu! Sử dụng email admin@vipi.vn và mật khẩu admin123 để thử nghiệm.');
      }
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) {
      setAuthError(error.message);
    } else {
      setSession(data.session);
    }
  };

  const handleLogout = async () => {
    if (isMockMode) {
      setSession(null);
      localStorage.removeItem('vipi_admin_session');
      return;
    }
    await supabase.auth.signOut();
    setSession(null);
  };

  // Product CRUD functions
  const openAddProductModal = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      price: '',
      stock: '',
      description: '',
      image_url: ''
    });
    setSelectedFile(null);
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      price: product.price,
      stock: product.stock,
      description: product.description || '',
      image_url: product.image_url || ''
    });
    setSelectedFile(null);
    setIsProductModalOpen(true);
  };

  const handleProductInputChange = (e) => {
    const { name, value } = e.target;
    setProductForm(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleProductSave = async (e) => {
    e.preventDefault();
    setSavingProduct(true);
    
    let uploadedImageUrl = productForm.image_url;

    try {
      // 1. Upload File if selected
      if (selectedFile) {
        if (isMockMode) {
          // Simulate upload
          await new Promise(resolve => setTimeout(resolve, 800));
          uploadedImageUrl = 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?q=80&w=600&auto=format&fit=cover'; // generic smart watch
        } else {
          // Upload to Supabase Storage
          const fileExt = selectedFile.name.split('.').pop();
          const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('products')
            .upload(filePath, selectedFile);

          if (uploadError) throw uploadError;

          // Get Public URL
          const { data } = supabase.storage.from('products').getPublicUrl(filePath);
          uploadedImageUrl = data.publicUrl;
        }
      }

      const finalProductData = {
        name: productForm.name,
        price: parseFloat(productForm.price),
        stock: parseInt(productForm.stock),
        description: productForm.description,
        image_url: uploadedImageUrl,
      };

      if (editingProduct) {
        // Update product
        if (isMockMode) {
          const updatedProducts = products.map(p => 
            p.id === editingProduct.id ? { ...p, ...finalProductData } : p
          );
          setProducts(updatedProducts);
          localStorage.setItem('vipi_products', JSON.stringify(updatedProducts));
        } else {
          const { error } = await supabase
            .from('products')
            .update(finalProductData)
            .eq('id', editingProduct.id);

          if (error) throw error;
        }
      } else {
        // Create new product
        if (isMockMode) {
          const newProduct = {
            id: crypto.randomUUID(),
            ...finalProductData,
            created_at: new Date().toISOString()
          };
          const updatedProducts = [newProduct, ...products];
          setProducts(updatedProducts);
          localStorage.setItem('vipi_products', JSON.stringify(updatedProducts));
        } else {
          const { error } = await supabase
            .from('products')
            .insert([finalProductData]);

          if (error) throw error;
        }
      }

      setIsProductModalOpen(false);
      loadAllData(); // reload
    } catch (err) {
      alert(`Lỗi lưu sản phẩm: ${err.message}`);
    } finally {
      setSavingProduct(false);
    }
  };

  const handleProductDelete = async (productId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa sản phẩm này không?')) return;

    try {
      if (isMockMode) {
        const updatedProducts = products.filter(p => p.id !== productId);
        setProducts(updatedProducts);
        localStorage.setItem('vipi_products', JSON.stringify(updatedProducts));
      } else {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', productId);

        if (error) throw error;
      }
      loadAllData();
    } catch (err) {
      alert(`Lỗi xóa sản phẩm: ${err.message}`);
    }
  };

  // Order status update
  const handleOrderStatusUpdate = async (orderId, newStatus) => {
    try {
      if (isMockMode) {
        const updatedOrders = orders.map(o => 
          o.id === orderId ? { ...o, status: newStatus } : o
        );
        setOrders(updatedOrders);
        localStorage.setItem('vipi_orders', JSON.stringify(updatedOrders));
      } else {
        const { error } = await supabase
          .from('orders')
          .update({ status: newStatus })
          .eq('id', orderId);

        if (error) throw error;
      }
      // Notify update
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch (err) {
      alert(`Lỗi cập nhật trạng thái đơn: ${err.message}`);
    }
  };

  // Mock simulator: creates a random new order
  const handleSimulateNewOrder = () => {
    if (products.length === 0) {
      alert('Vui lòng tạo ít nhất 1 sản phẩm trước khi giả lập đơn hàng.');
      return;
    }
    
    // Choose random product
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    const quantity = Math.floor(Math.random() * 2) + 1; // 1 or 2
    const totalPrice = randomProduct.price * quantity;

    const mockOrderId = 'ord-sim-' + Math.random().toString(36).substring(2, 7);
    const newOrder = {
      id: mockOrderId,
      customer_name: ['Lê Văn C', 'Phạm Thị D', 'Hoàng Văn E', 'Vũ Thị F'][Math.floor(Math.random() * 4)],
      phone: '09' + Math.floor(10000000 + Math.random() * 90000000),
      facebook_url: 'https://facebook.com/sim.profile.' + Math.floor(Math.random() * 100),
      address: `${Math.floor(Math.random() * 200)} Đường Cộng Hòa, Tân Bình, TP. HCM`,
      total_price: totalPrice,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const newOrderItem = {
      id: Date.now(),
      order_id: mockOrderId,
      product_id: randomProduct.id,
      quantity: quantity,
      price: randomProduct.price,
      product_name: randomProduct.name
    };

    // Update state & localstorage
    const updatedOrders = [newOrder, ...orders];
    const updatedItems = [newOrderItem, ...orderItems];
    
    setOrders(updatedOrders);
    setOrderItems(updatedItems);
    
    localStorage.setItem('vipi_orders', JSON.stringify(updatedOrders));
    localStorage.setItem('vipi_order_items', JSON.stringify(updatedItems));

    // Show banner notification
    setNewOrderAlert(newOrder);
    setTimeout(() => setNewOrderAlert(null), 8000);
  };

  // Helpers
  const formatVND = (number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(number);
  };

  const getOrderStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Chờ xử lý';
      case 'processing': return 'Đang xử lý';
      case 'completed': return 'Hoàn thành';
      case 'cancelled': return 'Đã hủy';
      default: return status;
    }
  };

  // Calculation for stats
  const totalSales = orders
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + parseFloat(o.total_price), 0);
  
  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
  const lowStockProductsCount = products.filter(p => p.stock <= 3).length;

  if (loadingSession) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)', color: 'var(--text-secondary)' }}>
        Đang khởi động hệ thống quản trị...
      </div>
    );
  }

  // 1. RENDER LOGIN SCREEN
  if (!session) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">
            <span className="gradient-text">SVTN VĨNH PHÚC ADMIN</span>
          </div>
          <h2 className="login-title">Hệ Thống Quản Trị Cửa Hàng</h2>
          
          {authError && <div className="error-message">{authError}</div>}
          
          {isMockMode && (
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--accent-amber)' }}>
              💡 Hệ thống đang chạy ở chế độ Demo. Đăng nhập bằng:
              <br /><strong>Email:</strong> admin@vipi.vn
              <br /><strong>Mật khẩu:</strong> admin123
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email Quản Trị *</label>
              <input 
                type="email" 
                required 
                className="form-input" 
                value={loginEmail} 
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@vipi.vn"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mật khẩu *</label>
              <input 
                type="password" 
                required 
                className="form-input" 
                value={loginPassword} 
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="btn" style={{ width: '100%', marginTop: '1rem', padding: '1rem' }}>
              Đăng Nhập
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. RENDER ADMIN LAYOUT
  return (
    <div className="admin-layout">
      {/* Real-time Order Toast */}
      {newOrderAlert && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#090e0a', border: '2px solid var(--accent-blue)', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem', animation: 'slideIn 0.3s ease-out', width: '320px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🔔 CÓ ĐƠN HÀNG MỚI!
            </span>
            <button onClick={() => setNewOrderAlert(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
          </div>
          <div style={{ fontSize: '0.9rem' }}>
            <p><strong>Khách hàng:</strong> {newOrderAlert.customer_name}</p>
            <p><strong>Giá trị:</strong> {formatVND(newOrderAlert.total_price)}</p>
          </div>
          <button className="btn btn-sm" style={{ alignSelf: 'flex-start', marginTop: '0.25rem' }} onClick={() => { setActiveTab('orders'); setNewOrderAlert(null); }}>
            Xem chi tiết
          </button>
        </div>
      )}

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="gradient-text">SVTN VĨNH PHÚC</span>
        </div>
        <ul className="sidebar-menu">
          <li className="sidebar-item">
            <button 
              className={`sidebar-link ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              📊 <span>Tổng quan</span>
            </button>
          </li>
          <li className="sidebar-item">
            <button 
              className={`sidebar-link ${activeTab === 'products' ? 'active' : ''}`}
              onClick={() => setActiveTab('products')}
            >
              📦 <span>Sản phẩm (CRUD)</span>
            </button>
          </li>
          <li className="sidebar-item">
            <button 
              className={`sidebar-link ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              🛒 <span>Đơn hàng</span>
            </button>
          </li>
        </ul>
        <div className="sidebar-footer">
          <button className="sidebar-link" onClick={handleLogout} style={{ color: 'var(--accent-rose)' }}>
            🚪 <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        
        {/* TAB 1: DASHBOARD OVERVIEW */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Tổng Quan Hệ Thống</h1>
              {isMockMode && (
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn btn-secondary" onClick={handleSimulateNewOrder}>
                    ⚡ Giả lập đơn hàng mới
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.85rem', color: 'var(--accent-amber)', background: 'rgba(245, 158, 11, 0.1)', padding: '0.5rem 1rem', borderRadius: '20px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                    ⚠️ Chế độ Demo
                  </span>
                </div>
              )}
            </div>

            {/* Metrics */}
            <div className="stats-grid">
              <div className="stat-card glow-card">
                <span className="stat-label">Doanh thu hoàn thành</span>
                <span className="stat-value gradient-text">{formatVND(totalSales)}</span>
                <span className="stat-desc">Tổng doanh số từ các đơn hàng thành công</span>
              </div>
              <div className="stat-card glow-card">
                <span className="stat-label">Tổng số đơn hàng</span>
                <span className="stat-value">{orders.length}</span>
                <span className="stat-desc">Đơn hàng được lưu trữ trong hệ thống</span>
              </div>
              <div className="stat-card glow-card">
                <span className="stat-label">Đơn hàng chờ xử lý</span>
                <span className="stat-value" style={{ color: pendingOrdersCount > 0 ? 'var(--accent-amber)' : 'inherit' }}>
                  {pendingOrdersCount}
                </span>
                <span className="stat-desc">Đơn hàng mới đang chờ duyệt</span>
              </div>
              <div className="stat-card glow-card">
                <span className="stat-label">Sản phẩm sắp hết hàng</span>
                <span className="stat-value" style={{ color: lowStockProductsCount > 0 ? 'var(--accent-rose)' : 'inherit' }}>
                  {lowStockProductsCount}
                </span>
                <span className="stat-desc">Sản phẩm có số lượng kho &le; 3</span>
              </div>
            </div>

            {/* Recent Orders List */}
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>Đơn hàng gần đây</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Khách hàng</th>
                    <th>Điện thoại</th>
                    <th>Tổng tiền</th>
                    <th>Trạng thái</th>
                    <th>Ngày mua</th>
                    <th style={{ textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 5).map(order => (
                    <tr key={order.id}>
                      <td style={{ fontWeight: 'bold' }}>{order.customer_name}</td>
                      <td><code>{order.phone}</code></td>
                      <td style={{ fontWeight: 'bold' }}>{formatVND(order.total_price)}</td>
                      <td>
                        <span className={`badge badge-${order.status}`}>
                          {getOrderStatusLabel(order.status)}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {new Date(order.created_at).toLocaleString('vi-VN')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {(order.status === 'pending' || order.status === 'processing') ? (
                          <button 
                            className="btn btn-sm" 
                            style={{ background: 'var(--accent-green)', color: 'white', padding: '0.35rem 0.75rem', fontSize: '0.8rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                            onClick={() => handleOrderStatusUpdate(order.id, 'completed')}
                          >
                            ✓ Hoàn thành
                          </button>
                        ) : order.status === 'completed' ? (
                          <span style={{ color: 'var(--accent-green)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                            🟢 Đã xong
                          </span>
                        ) : (
                          <span style={{ color: 'var(--accent-rose)', fontSize: '0.85rem' }}>Đã hủy</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        Chưa có đơn hàng nào được ghi nhận.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: PRODUCTS CRUD MANAGEMENT */}
        {activeTab === 'products' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Quản Lý Sản Phẩm</h1>
              <button className="btn" onClick={openAddProductModal}>
                ➕ Thêm sản phẩm mới
              </button>
            </div>

            {loadingData ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                Đang tải dữ liệu sản phẩm...
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Hình ảnh</th>
                      <th>Tên sản phẩm</th>
                      <th>Đơn giá</th>
                      <th>Số lượng kho</th>
                      <th>Mô tả</th>
                      <th style={{ textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(product => (
                      <tr key={product.id}>
                        <td>
                          <img 
                            src={product.image_url || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=150&auto=format&fit=cover'} 
                            alt={product.name} 
                            className="product-thumb"
                            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=150&auto=format&fit=cover'; }}
                          />
                        </td>
                        <td style={{ fontWeight: 'bold' }}>{product.name}</td>
                        <td style={{ fontWeight: 'bold' }}>{formatVND(product.price)}</td>
                        <td>
                          <span style={{ 
                            color: product.stock === 0 ? 'var(--accent-rose)' : product.stock <= 3 ? 'var(--accent-amber)' : 'inherit',
                            fontWeight: product.stock <= 3 ? 'bold' : 'normal'
                          }}>
                            {product.stock}
                          </span>
                        </td>
                        <td style={{ maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-secondary)' }}>
                          {product.description || 'Chưa cập nhật'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => openEditProductModal(product)}>
                              ✏️ Sửa
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleProductDelete(product.id)}>
                              🗑️ Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {products.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                          Chưa có sản phẩm nào. Hãy bấm "Thêm sản phẩm mới".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ORDERS MANAGEMENT */}
        {activeTab === 'orders' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Quản Lý Đơn Hàng</h1>
            </div>

            {loadingData ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                Đang tải dữ liệu đơn hàng...
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Khách hàng</th>
                      <th>Số điện thoại</th>
                      <th>Facebook chat</th>
                      <th>Địa chỉ giao hàng</th>
                      <th>Tổng tiền</th>
                      <th>Trạng thái</th>
                      <th style={{ textAlign: 'right' }}>Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => {
                      const fbUsername = extract_username(order.facebook_url);
                      const messengerHref = fbUsername ? `https://m.me/${fbUsername}` : null;
                      
                      return (
                        <tr key={order.id}>
                          <td><code>{order.id.slice(0, 8)}...</code></td>
                          <td style={{ fontWeight: 'bold' }}>{order.customer_name}</td>
                          <td><code>{order.phone}</code></td>
                          <td>
                            {messengerHref ? (
                              <a href={messengerHref} target="_blank" rel="noopener noreferrer" className="messenger-link">
                                💬 Chat Messenger
                              </a>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Không có link</span>
                            )}
                          </td>
                          <td style={{ maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-secondary)' }} title={order.address}>
                            {order.address}
                          </td>
                          <td style={{ fontWeight: 'bold' }}>{formatVND(order.total_price)}</td>
                          <td>
                            <select 
                              className="form-select" 
                              style={{ width: 'auto', padding: '0.35rem 0.5rem', background: '#161f30', fontSize: '0.85rem' }}
                              value={order.status}
                              onChange={(e) => handleOrderStatusUpdate(order.id, e.target.value)}
                            >
                              <option value="pending">Chờ xử lý</option>
                              <option value="processing">Đang xử lý</option>
                              <option value="completed">Hoàn thành</option>
                              <option value="cancelled">Đã hủy</option>
                            </select>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedOrder(order)}>
                              👁️ Xem mặt hàng
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {orders.length === 0 && (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                          Chưa có đơn đặt hàng nào trong hệ thống.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </main>

      {/* CRUD PRODUCT MODAL */}
      <div className={`modal-overlay ${isProductModalOpen ? 'open' : ''}`} onClick={() => setIsProductModalOpen(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{editingProduct ? 'Chỉnh Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới'}</h3>
            <button className="modal-close" onClick={() => setIsProductModalOpen(false)}>×</button>
          </div>
          <form onSubmit={handleProductSave}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Tên sản phẩm *</label>
                <input 
                  type="text" 
                  name="name" 
                  required 
                  className="form-input" 
                  value={productForm.name} 
                  onChange={handleProductInputChange}
                  placeholder="Ví dụ: Tai nghe chống ồn Sony"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Đơn giá (VND) *</label>
                  <input 
                    type="number" 
                    name="price" 
                    required 
                    className="form-input" 
                    value={productForm.price} 
                    onChange={handleProductInputChange}
                    placeholder="Ví dụ: 6990000"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Số lượng trong kho *</label>
                  <input 
                    type="number" 
                    name="stock" 
                    required 
                    className="form-input" 
                    value={productForm.stock} 
                    onChange={handleProductInputChange}
                    placeholder="Ví dụ: 10"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Mô tả chi tiết</label>
                <textarea 
                  name="description" 
                  className="form-textarea" 
                  value={productForm.description} 
                  onChange={handleProductInputChange}
                  placeholder="Thông số kỹ thuật, bảo hành..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Ảnh sản phẩm</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="form-input" 
                  onChange={handleFileChange}
                />
                {productForm.image_url && !selectedFile && (
                  <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                    Đã có ảnh: <a href={productForm.image_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)' }}>Xem ảnh hiện tại</a>
                  </p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsProductModalOpen(false)}>
                Hủy bỏ
              </button>
              <button type="submit" className="btn" disabled={savingProduct}>
                {savingProduct ? 'Đang lưu sản phẩm...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* VIEW ORDER ITEMS DETAILS MODAL */}
      <div className={`modal-overlay ${selectedOrder ? 'open' : ''}`} onClick={() => setSelectedOrder(null)}>
        <div className="modal-content" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Chi Tiết Đơn Hàng <code>{selectedOrder?.id.slice(0, 8)}</code></h3>
            <button className="modal-close" onClick={() => setSelectedOrder(null)}>×</button>
          </div>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Customer short summary */}
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem' }}>
              <p style={{ marginBottom: '0.25rem' }}><strong>Khách hàng:</strong> {selectedOrder?.customer_name}</p>
              <p style={{ marginBottom: '0.25rem' }}><strong>Điện thoại:</strong> {selectedOrder?.phone}</p>
              <p style={{ marginBottom: '0.25rem' }}><strong>Địa chỉ:</strong> {selectedOrder?.address}</p>
              <p><strong>Ngày đặt hàng:</strong> {selectedOrder && new Date(selectedOrder.created_at).toLocaleString('vi-VN')}</p>
            </div>

            <h4 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Mặt hàng đã mua</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {orderItems
                .filter(item => item.order_id === selectedOrder?.id)
                .map((item, idx) => (
                  <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{item.product_name}</p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        Đơn giá: {formatVND(item.price)}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: 'bold' }}>x{item.quantity}</p>
                      <p style={{ color: 'var(--accent-blue)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                        {formatVND(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              {orderItems.filter(item => item.order_id === selectedOrder?.id).length === 0 && (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                  Không tìm thấy mặt hàng nào cho đơn này (hoặc sản phẩm bị xóa).
                </p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border-color)', paddingTop: '1rem', fontWeight: 'bold', fontSize: '1.1rem' }}>
              <span>Tổng cộng:</span>
              <span className="gradient-text">{selectedOrder && formatVND(selectedOrder.total_price)}</span>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn" onClick={() => setSelectedOrder(null)}>
              Đóng lại
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

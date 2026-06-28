import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { CartProvider, useCart } from './CartContext';
import './App.css';

// Mock products to use if Supabase connection fails or is not configured yet
const MOCK_PRODUCTS = [
  {
    id: 'a3d2e1b1-2e6f-4c12-9db8-17a42a59a901',
    name: 'iPhone 15 Pro Max 256GB',
    price: 30990000,
    description: 'Thiết kế titan bền bỉ, chip A17 Pro mạnh mẽ vượt trội và hệ thống camera zoom quang học 5x chuyên nghiệp nhất từ trước đến nay.',
    image_url: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?q=80&w=600&auto=format&fit=cover',
    stock: 8,
  },
  {
    id: 'b4e3d2c2-3f7a-4d23-ad99-28b53b60b012',
    name: 'MacBook Pro 14" M3 Pro',
    price: 49990000,
    description: 'Hiệu năng đồ họa đỉnh cao với chip M3 Pro, màn hình Liquid Retina XDR siêu nét cùng thời lượng pin lên đến 22 giờ liên tục.',
    image_url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=600&auto=format&fit=cover',
    stock: 5,
  },
  {
    id: 'c5f4e3d3-4a8b-4e34-be00-39c64c71c123',
    name: 'AirPods Pro 2 USB-C',
    price: 5790000,
    description: 'Chủ động khử tiếng ồn gấp 2 lần, âm thanh thích ứng thông minh và hộp sạc MagSafe tiện lợi hỗ trợ chuẩn kết nối USB-C mới.',
    image_url: 'https://images.unsplash.com/photo-1588449668365-d15e397f6787?q=80&w=600&auto=format&fit=cover',
    stock: 15,
  },
  {
    id: 'd6g5f4e4-5b9c-4f45-cf11-4ad75d82d234',
    name: 'Sony WH-1000XM5 ANC',
    price: 6990000,
    description: 'Tai nghe chụp tai chống ồn hàng đầu thế giới với bộ xử lý tích hợp V1, thời lượng pin 30 giờ và công nghệ đàm thoại rực rỡ.',
    image_url: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?q=80&w=600&auto=format&fit=cover',
    stock: 3,
  },
  {
    id: 'e7h6g5f5-6ca0-4g56-df22-5be86e93e345',
    name: 'iPad Pro 11" M4 Wifi 256GB',
    price: 28990000,
    description: 'Mỏng nhẹ kinh ngạc với màn hình Ultra Retina XDR OLED kép đột phá và sức mạnh không giới hạn từ thế hệ chip Apple M4.',
    image_url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?q=80&w=600&auto=format&fit=cover',
    stock: 0, // Out of stock to test disabled button state
  }
];

function AppContent() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null); // stores order ID when successful
  const [isMockMode, setIsMockMode] = useState(false);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    customer_name: '',
    phone: '',
    facebook_url: '',
    address: ''
  });
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartCount
  } = useCart();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Check if URL is placeholder
      const isPlaceholderUrl = supabase.supabaseUrl.includes('your-supabase-url');
      
      if (isPlaceholderUrl) {
        console.log('Using local mock products (Supabase URL is placeholder)');
        setProducts(MOCK_PRODUCTS);
        setIsMockMode(true);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        setProducts(data);
        setIsMockMode(false);
      } else {
        // If DB is empty, seed with mock data for visual demonstration
        console.log('Database empty, displaying mock products.');
        setProducts(MOCK_PRODUCTS);
        setIsMockMode(true);
      }
    } catch (err) {
      console.warn('Error connecting to Supabase, falling back to mock data:', err.message);
      setProducts(MOCK_PRODUCTS);
      setIsMockMode(true);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const formatVND = (number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(number);
  };

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;
    
    setSubmittingOrder(true);

    const orderPayload = {
      p_customer_name: formData.customer_name,
      p_phone: formData.phone,
      p_facebook_url: formData.facebook_url,
      p_address: formData.address,
      p_total_price: getCartTotal(),
      p_items: cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity
      }))
    };

    try {
      if (isMockMode) {
        // Simulate database transaction in mock mode
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Update mock stock in state
        setProducts(prevProducts => 
          prevProducts.map(p => {
            const cartItem = cart.find(item => item.product.id === p.id);
            if (cartItem) {
              const newStock = Math.max(0, p.stock - cartItem.quantity);
              return { ...p, stock: newStock };
            }
            return p;
          })
        );
        
        const mockOrderId = crypto.randomUUID();
        setOrderSuccess(mockOrderId);
        clearCart();
        setIsCheckoutOpen(false);
      } else {
        // Live Supabase RPC call
        const { data: orderId, error } = await supabase.rpc('create_order_transaction', orderPayload);

        if (error) {
          throw new Error(error.message);
        }

        setOrderSuccess(orderId);
        clearCart();
        setIsCheckoutOpen(false);
        // Refresh products from database to update stock levels
        fetchProducts();
      }
      
      // Reset form
      setFormData({
        customer_name: '',
        phone: '',
        facebook_url: '',
        address: ''
      });
    } catch (err) {
      alert(`Đặt hàng thất bại: ${err.message}`);
    } finally {
      setSubmittingOrder(false);
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <a href="/" className="logo">
          <span className="gradient-text">Đội Sinh viên Tình nguyện Vĩnh Phúc</span>
          <span className="logo-dot"></span>
        </a>
        <div className="header-actions">
          <button className="cart-toggle" onClick={() => setIsCartOpen(true)}>
            🛒 Giỏ hàng
            {getCartCount() > 0 && <span className="cart-count">{getCartCount()}</span>}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <h1>
          <span className="gradient-text">Đội Sinh viên Tình nguyện Vĩnh Phúc</span>
        </h1>
      </section>

      {/* Catalog */}
      <main className="catalog-section">
        <div className="catalog-header">
          <h2 className="catalog-title">Sản Phẩm Nổi Bật</h2>
          {isMockMode && (
            <span style={{ fontSize: '0.85rem', color: 'var(--accent-amber)', background: 'rgba(245, 158, 11, 0.1)', padding: '0.35rem 0.75rem', borderRadius: '20px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              ⚠️ Chế độ ngoại tuyến (Mock Data)
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            Đang tải sản phẩm...
          </div>
        ) : (
          <div className="product-grid">
            {products.map((product) => {
              const isOutOfStock = product.stock === 0;
              const isLowStock = product.stock > 0 && product.stock <= 3;
              
              return (
                <div key={product.id} className="product-card glow-card">
                  <div className="product-image-container">
                    <img 
                      src={product.image_url || 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=600&auto=format&fit=cover'} 
                      alt={product.name} 
                      className="product-image"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=600&auto=format&fit=cover';
                      }}
                    />
                    <span className={`product-badge ${isOutOfStock ? 'out-of-stock' : isLowStock ? 'low-stock' : 'in-stock'}`}>
                      {isOutOfStock ? 'Hết hàng' : isLowStock ? `Chỉ còn ${product.stock} sản phẩm` : 'Còn hàng'}
                    </span>
                  </div>
                  <div className="product-details">
                    <h3 className="product-name">{product.name}</h3>
                    <p className="product-desc">{product.description}</p>
                    <div className="product-footer">
                      <span className="product-price">{formatVND(product.price)}</span>
                      <button 
                        className="btn" 
                        disabled={isOutOfStock}
                        onClick={() => addToCart(product)}
                      >
                        {isOutOfStock ? 'Hết hàng' : 'Mua ngay'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Cart Sidebar */}
      <div className={`cart-sidebar-overlay ${isCartOpen ? 'open' : ''}`} onClick={() => setIsCartOpen(false)}>
        <div className="cart-sidebar" onClick={(e) => e.stopPropagation()}>
          <div className="cart-header">
            <h3>Giỏ Hàng Của Bạn</h3>
            <button className="cart-close" onClick={() => setIsCartOpen(false)}>×</button>
          </div>

          <div className="cart-items">
            {cart.length === 0 ? (
              <div className="cart-empty-message">
                <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛒</p>
                <p>Giỏ hàng trống.</p>
                <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Hãy chọn sản phẩm bạn yêu thích nhé!</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} className="cart-item">
                  <img 
                    src={item.product.image_url} 
                    alt={item.product.name} 
                    className="cart-item-image"
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=600&auto=format&fit=cover';
                    }}
                  />
                  <div className="cart-item-info">
                    <h4 className="cart-item-name">{item.product.name}</h4>
                    <p className="cart-item-price">{formatVND(item.product.price)}</p>
                    <div className="cart-item-actions">
                      <button 
                        className="qty-btn" 
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.product.stock)}
                      >
                        -
                      </button>
                      <span className="cart-item-qty">{item.quantity}</span>
                      <button 
                        className="qty-btn" 
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.product.stock)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button className="cart-item-remove" onClick={() => removeFromCart(item.product.id)}>
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <div className="cart-footer">
              <div className="cart-total-row">
                <span>Tổng cộng:</span>
                <span className="gradient-text">{formatVND(getCartTotal())}</span>
              </div>
              <button 
                className="btn" 
                style={{ width: '100%', padding: '1rem' }}
                onClick={() => {
                  setIsCartOpen(false);
                  setIsCheckoutOpen(true);
                }}
              >
                Tiến hành Đặt hàng
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Checkout Form Modal */}
      <div className={`modal-overlay ${isCheckoutOpen ? 'open' : ''}`} onClick={() => setIsCheckoutOpen(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="modal-title">Thông Tin Thanh Toán</h3>
            <button className="cart-close" onClick={() => setIsCheckoutOpen(false)}>×</button>
          </div>
          <div className="modal-body">
            <form onSubmit={handleCheckoutSubmit}>
              <div className="form-group">
                <label className="form-label">Họ và Tên *</label>
                <input 
                  type="text" 
                  name="customer_name" 
                  required 
                  className="form-input" 
                  value={formData.customer_name} 
                  onChange={handleInputChange}
                  placeholder="Ví dụ: Nguyễn Văn A"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Số Điện Thoại *</label>
                <input 
                  type="tel" 
                  name="phone" 
                  required 
                  className="form-input" 
                  value={formData.phone} 
                  onChange={handleInputChange}
                  placeholder="Ví dụ: 0912345678"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Liên kết Facebook (Link hoặc Username)</label>
                <input 
                  type="text" 
                  name="facebook_url" 
                  className="form-input" 
                  value={formData.facebook_url} 
                  onChange={handleInputChange}
                  placeholder="Ví dụ: facebook.com/nct0107 hoặc nct0107"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Địa Chỉ Nhận Hàng *</label>
                <input 
                  type="text" 
                  name="address" 
                  required 
                  className="form-input" 
                  value={formData.address} 
                  onChange={handleInputChange}
                  placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố"
                />
              </div>

              <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#4b5563' }}>
                  <span>Số lượng mặt hàng:</span>
                  <span>{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>Tổng tiền thanh toán:</span>
                  <span className="gradient-text">{formatVND(getCartTotal())}</span>
                </div>
              </div>

              <button 
                type="submit" 
                className="btn form-submit-btn" 
                disabled={submittingOrder}
              >
                {submittingOrder ? 'Đang xử lý đặt hàng...' : 'Xác Nhận Đặt Hàng'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <div className={`modal-overlay ${orderSuccess ? 'open' : ''}`} onClick={() => setOrderSuccess(null)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="success-modal">
            <div className="success-icon">✓</div>
            <h3 className="success-title">Đặt Hàng Thành Công!</h3>
            <p className="success-text">
              Cảm ơn bạn đã mua sắm tại Đội Sinh viên Tình nguyện Vĩnh Phúc. Đơn hàng của bạn đã được tiếp nhận và xử lý thành công.
              <br />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Mã đơn hàng: <code style={{ color: 'var(--accent-blue)', background: 'rgba(59, 130, 246, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{orderSuccess}</code>
              </span>
            </p>
            <button className="btn btn-secondary" style={{ margin: '0 auto' }} onClick={() => setOrderSuccess(null)}>
              Tiếp tục mua sắm
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} Đội Sinh viên Tình nguyện Vĩnh Phúc</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <CartProvider>
      <AppContent />
    </CartProvider>
  );
}

const mysql = require('mysql2/promise');
const config = require('../config/env');

let pool;

const createPool = () => {
    if (!pool) {
        pool = mysql.createPool({
            host: config.mysql.host,
            user: config.mysql.user,
            password: config.mysql.password,
            database: config.mysql.database,
            port: config.mysql.port,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0
        });
    }
    return pool;
};


const db = {
    users: {
        getByPhone: async (phone) => {
            try {
                const pool = createPool();
                const [rows] = await pool.execute(
                    'SELECT * FROM users WHERE phone_number = ?',
                    [phone]
                );

                if (rows.length === 0) return null;

                const user = rows[0];

                // Busca carrinho do pedido pendente
                const cart = await db.cart.get({ id: user.id, fields: { PhoneNumber: phone } });

                return {
                    id: user.id,
                    fields: {
                        PhoneNumber: user.phone_number,
                        State: user.state,
                        Cart: JSON.stringify(cart.cartItems.map(item => ({
                            productId: item.productId,
                            productName: item.title,
                            quantity: item.quantity
                        }))),
                        Address: user.address || '',
                        Email: user.email || '',
                        Name: user.name,
                        LastShownProducts: user.last_shown_products || '[]'
                    }
                };
            } catch (error) {
                return null;
            }
        },

        create: async (phone, state) => {
            try {
                const pool = createPool();
                const [result] = await pool.execute(
                    'INSERT INTO users (phone_number, state) VALUES (?, ?)',
                    [phone, state]
                );

                return {
                    id: result.insertId,
                    fields: {
                        PhoneNumber: phone,
                        State: state,
                        Cart: '[]'
                    }
                };
            } catch (error) {
                return null;
            }
        },

        update: async (userId, fields) => {
            try {
                const pool = createPool();
                const updates = [];
                const values = [];

                // Busca o telefone do usuário
                const [userRows] = await pool.execute('SELECT phone_number FROM users WHERE id = ?', [userId]);
                if (userRows.length === 0) return null;
                const phone = userRows[0].phone_number;

                if (fields.State !== undefined) {
                    updates.push('state = ?');
                    values.push(fields.State);
                }
                if (fields.Name !== undefined) {
                    updates.push('name = ?');
                    values.push(fields.Name);
                }
                if (fields.Address !== undefined) {
                    updates.push('address = ?');
                    values.push(fields.Address);
                }
                if (fields.LastShownProducts !== undefined) {
                    updates.push('last_shown_products = ?');
                    values.push(fields.LastShownProducts);
                }
                if (fields.Email !== undefined) {
                    updates.push('email = ?');
                    values.push(fields.Email);
                }

                if (updates.length > 0) {
                    values.push(userId);
                    await pool.execute(
                        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                        values
                    );
                }

                const [rows] = await pool.execute(
                    'SELECT * FROM users WHERE id = ?',
                    [userId]
                );

                const user = rows[0];
                const cart = await db.cart.get({ id: user.id, fields: { PhoneNumber: phone } });

                return {
                    id: user.id,
                    fields: {
                        PhoneNumber: user.phone_number,
                        State: user.state,
                        Cart: JSON.stringify(cart.cartItems.map(item => ({
                            productId: item.productId,
                            productName: item.title,
                            quantity: item.quantity
                        }))),
                        Address: user.address || '',
                        Email: user.email || '',
                        Name: user.name,
                        LastShownProducts: user.last_shown_products || '[]'
                    }
                };
            } catch (error) {
                return null;
            }
        }
    },

    products: {
        getAll: async () => {
            try {
                const pool = createPool();
                const [rows] = await pool.execute('SELECT * FROM products');

                return rows.map(product => ({
                    id: product.id,
                    fields: {
                        Title: product.title,
                        Color: product.color,
                        Price: product.price,
                        Quantity: product.quantity,
                        ImageURL: product.image_url
                    }
                }));
            } catch (error) {
                return [];
            }
        }
    },

    cart: {
        // Busca ou cria order pendente do usuário
        getOrCreatePendingOrder: async (phone) => {
            const pool = createPool();

            // Busca order pendente
            const [orders] = await pool.execute(
                'SELECT * FROM orders WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
                [phone, 'Pending']
            );

            if (orders.length > 0) {
                return orders[0].id;
            }

            // Cria nova order pendente
            const [result] = await pool.execute(
                'INSERT INTO orders (user_id, status, amount) VALUES (?, ?, ?)',
                [phone, 'Pending', 0]
            );

            return result.insertId;
        },

        add: async (user, productName) => {
            try {
                const pool = createPool();
                const products = await db.products.getAll();

                const product = products.find(p =>
                    p.fields.Title.toLowerCase().includes(productName.toLowerCase())
                );

                if (!product) {
                    return { success: false };
                }

                const phone = user.fields.PhoneNumber;
                const orderId = await db.cart.getOrCreatePendingOrder(phone);

                // Verifica se produto já existe no carrinho
                const [existing] = await pool.execute(
                    'SELECT quantity FROM order_products WHERE order_id = ? AND product_id = ?',
                    [orderId, product.id]
                );

                if (existing.length > 0) {
                    // Incrementa quantidade
                    await pool.execute(
                        'UPDATE order_products SET quantity = quantity + 1 WHERE order_id = ? AND product_id = ?',
                        [orderId, product.id]
                    );
                } else {
                    // Adiciona novo produto com quantidade 1
                    await pool.execute(
                        'INSERT INTO order_products (order_id, product_id, quantity) VALUES (?, ?, 1)',
                        [orderId, product.id]
                    );
                }

                // Atualiza valor total da order
                const cart = await db.cart.get(user);
                const total = cart.cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

                await pool.execute(
                    'UPDATE orders SET amount = ? WHERE id = ?',
                    [total, orderId]
                );

                return { success: true, cartItems: cart.cartItems };
            } catch (error) {
                return { success: false };
            }
        },

        get: async (user) => {
            try {
                const pool = createPool();
                const phone = user.fields.PhoneNumber;

                // Busca order pendente
                const [orders] = await pool.execute(
                    'SELECT * FROM orders WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
                    [phone, 'Pending']
                );

                if (orders.length === 0) {
                    return { success: true, cartItems: [] };
                }

                const orderId = orders[0].id;

                // Busca produtos da order com quantidade
                const [items] = await pool.execute(
                    `SELECT p.id, p.title, p.price, op.quantity
                     FROM order_products op
                     JOIN products p ON op.product_id = p.id
                     WHERE op.order_id = ?`,
                    [orderId]
                );

                const cartItems = items.map(item => ({
                    productId: item.id,
                    title: item.title,
                    price: item.price,
                    quantity: item.quantity
                }));

                return { success: true, cartItems };
            } catch (error) {
                return { success: false, cartItems: [] };
            }
        },

        remove: async (user, productId) => {
            try {
                const pool = createPool();
                const products = await db.products.getAll();

                const product = products.find(p => p.id === parseInt(productId));

                if (!product) {
                    return { success: false, message: 'Produto não encontrado' };
                }

                const phone = user.fields.PhoneNumber;

                // Busca order pendente
                const [orders] = await pool.execute(
                    'SELECT * FROM orders WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
                    [phone, 'Pending']
                );

                if (orders.length === 0) {
                    return { success: false, message: 'Carrinho vazio' };
                }

                const orderId = orders[0].id;

                // Busca quantidade atual
                const [current] = await pool.execute(
                    'SELECT quantity FROM order_products WHERE order_id = ? AND product_id = ?',
                    [orderId, product.id]
                );

                if (current.length === 0) {
                    return { success: false, message: 'Produto não está no carrinho' };
                }

                if (current[0].quantity > 1) {
                    // Decrementa quantidade
                    await pool.execute(
                        'UPDATE order_products SET quantity = quantity - 1 WHERE order_id = ? AND product_id = ?',
                        [orderId, product.id]
                    );
                } else {
                    // Remove produto do carrinho
                    await pool.execute(
                        'DELETE FROM order_products WHERE order_id = ? AND product_id = ?',
                        [orderId, product.id]
                    );
                }

                // Atualiza valor total da order
                const cart = await db.cart.get(user);
                const total = cart.cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

                await pool.execute(
                    'UPDATE orders SET amount = ? WHERE id = ?',
                    [total, orderId]
                );

                return {
                    success: true,
                    cartItems: cart.cartItems,
                    message: cart.cartItems.length === 0 ? 'Carrinho esvaziado' : 'Item removido'
                };
            } catch (error) {
                return { success: false, message: 'Erro ao remover item' };
            }
        }
    },

    orders: {
        createOrUpdate: async (user, paymentInfo = {}) => {
            try {
                const pool = createPool();
                const phone = user.fields.PhoneNumber;

                // Busca order pendente
                const [existingOrders] = await pool.execute(
                    'SELECT * FROM orders WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
                    [phone, 'Pending']
                );

                if (existingOrders.length === 0) {
                    return { success: false, message: 'Carrinho vazio' };
                }

                const orderId = existingOrders[0].id;

                // Busca items do carrinho
                const cart = await db.cart.get(user);
                const cartItems = cart.cartItems;

                if (cartItems.length === 0) {
                    return { success: false, message: 'Carrinho vazio' };
                }

                // Calcula total
                const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                const amount = paymentInfo.transaction_amount || totalAmount;

                // Atualiza order para Paid
                const payerEmail = paymentInfo.payer?.email || paymentInfo.payer?.email_address || user.fields.Email || '';

                // Salva email no banco de dados se vier do pagamento
                if (payerEmail && !user.fields.Email) {
                    await pool.execute(
                        'UPDATE users SET email = ? WHERE phone_number = ?',
                        [payerEmail, phone]
                    );
                }

                await pool.execute(
                    'UPDATE orders SET status = ?, shipping_address = ?, payer_id = ?, payer_email = ?, amount = ? WHERE id = ?',
                    [
                        'Paid',
                        user.fields.Address || '',
                        paymentInfo.payer?.id || paymentInfo.id || '',
                        payerEmail,
                        parseFloat(amount),
                        orderId
                    ]
                );

                // Atualiza estoque
                const products = await db.products.getAll();
                for (const item of cartItems) {
                    const product = products.find(p => p.id === item.productId);
                    if (product && product.fields.Quantity) {
                        const newQuantity = parseInt(product.fields.Quantity) - item.quantity;

                        if (newQuantity >= 0) {
                            await pool.execute(
                                'UPDATE products SET quantity = ? WHERE id = ?',
                                [newQuantity, product.id]
                            );
                        }
                    }
                }

                return {
                    success: true,
                    order: {
                        id: orderId,
                        fields: {
                            Items: JSON.stringify(cartItems.map(item => ({
                                productId: item.productId,
                                productName: item.title,
                                quantity: item.quantity
                            })))
                        }
                    }
                };
            } catch (error) {
                return { success: false, error: error.message };
            }
        }
    }
};

module.exports = {
    db,
    getUserByPhone: db.users.getByPhone,
    createUser: db.users.create,
    updateUser: db.users.update,
    getProducts: db.products.getAll,
    addToCart: db.cart.add,
    getCart: db.cart.get,
    removeFromCart: db.cart.remove,
    createOrUpdateOrder: db.orders.createOrUpdate,
    closePool: async () => {
        if (pool) {
            await pool.end();
            pool = null;
        }
    }
};

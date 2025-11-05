const cartListEl = document.getElementById('cartList');
const amountTxtEl = document.getElementById('amountText');

const baseURL = window.location.origin;
const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get('userId');

// Validate userId
if (!userId) {
  alert('Usuário não identificado');
  throw new Error('Missing userId parameter');
}

let amount = 0;

const sendRequest = async (body) => {
    const url = `${baseURL}/checkout`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (err) {
        console.error('Request error:', err);
        return undefined;
    }
};

const initMercadoPagoButton = async () => {
  try {
    const body = {
      action: 'createPreference',
      userId,
      amount,
    };

    const response = await sendRequest(body);

    if (!response || !response.preferenceId) {
      alert('Erro ao criar preferência de pagamento');
      return;
    }

    const mp = new MercadoPago(response.publicKey, {
      locale: 'pt-BR'
    });

    mp.bricks().create('wallet', 'mercadopago-button', {
      initialization: {
        preferenceId: response.preferenceId,
      },
      callbacks: {
        onReady: () => {
          console.log('Mercado Pago pronto');
        },
        onSubmit: async () => {
          // Coleta os dados do formulário
          const inputName = document.getElementById('inputName');
          const inputAddress = document.getElementById('inputAddress');

          const name = inputName?.value.trim();
          const address = inputAddress?.value.trim();

          // Valida os campos
          if (!name || !address) {
            alert('Por favor, preencha todos os campos antes de continuar');
            throw new Error('Campos obrigatórios não preenchidos');
          }

          // Salva as informações do cliente
          const body = {
            action: 'updateCustomerInfo',
            userId,
            name,
            address,
          };

          const response = await sendRequest(body);

          if (!response || !response.success) {
            throw new Error('Erro ao salvar informações do cliente');
          }

          console.log('Informações do cliente salvas com sucesso');
        },
        onError: (error) => {
          console.error('Erro Mercado Pago:', error);
          alert('Erro no pagamento. Tente novamente.');
        },
      },
    });
  } catch (error) {
    console.error('Erro ao inicializar Mercado Pago:', error);
    alert('Erro ao inicializar pagamento');
  }
};

const getCheckoutInformation = async () => {
  try {
    // Reset amount before calculating
    amount = 0;

    const body = {
      action: 'getCheckoutInformation',
      userId,
    };

    const response = await sendRequest(body);

    if (!response) {
      alert('Erro ao carregar informações do carrinho');
      return;
    }

    if (!response.success || !response.cartItems || response.cartItems.length === 0) {
      const errorMsg = response.error || 'Carrinho vazio. Adicione produtos antes de finalizar a compra.';
      alert(errorMsg);
      console.error('Checkout error:', response);
      return;
    }
    
    const { cartItems, name, address } = response;
    
    // Update input fields correctly
    const inputName = document.getElementById('inputName');
    const inputAddress = document.getElementById('inputAddress');
    
    if (inputName) inputName.value = name || '';
    if (inputAddress) inputAddress.value = address || '';
    
    // Clear existing cart items
    cartListEl.innerHTML = '';
    
    cartItems.forEach(item => {
      const price = parseFloat(item.product.Price);
      const { quantity } = item;
      const title = item.product.Title;
      const imageURL = item.product.ImageURL || `${baseURL}/assets/images/default.jpg`;
      const itemTotal = quantity * price;
      amount += itemTotal;

      const listItemElement = document.createElement('li');
      listItemElement.className = 'list-group-item cart-item';
      listItemElement.innerHTML = `
        <div class="cart-item-content">
          <div class="cart-item-image">
            <img src="${imageURL}" alt="${title}">
          </div>
          <div class="cart-item-details">
            <div class="cart-item-title">${title}</div>
            <div class="cart-item-meta">
              <span class="cart-item-price">R$ ${price.toFixed(2)}</span>
              <span class="cart-item-quantity">Qtd: ${quantity}</span>
            </div>
          </div>
          <div class="cart-item-total">
            R$ ${itemTotal.toFixed(2)}
          </div>
        </div>`;
      cartListEl.appendChild(listItemElement);
    });
    
    amountTxtEl.innerText = `R$ ${amount.toFixed(2)}`;
    await initMercadoPagoButton();
    
  } catch (error) {
    console.error('Erro ao carregar checkout:', error);
    alert('Erro ao carregar informações. Recarregue a página.');
  }
};

// Prevenir submit do formulário
const form = document.getElementById('form');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    return false;
  });
}

getCheckoutInformation();
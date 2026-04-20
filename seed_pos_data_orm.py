# =============================================================================
#  SEED DATA - POS Orders via ORM de Odoo 16
#  Compatible con: odoo shell -d <tu_db> --no-http < seed_pos_data_orm.py
# =============================================================================
#
#  INSTRUCCIONES:
#  1. Copiar al contenedor:
#       docker cp seed_pos_data_orm.py odoo16-docker-odoo-1:/tmp/seed_pos_data_orm.py
#  2. Ejecutar:
#       docker exec -it odoo16-docker-odoo-1 bash
#       odoo shell -d test_data_14 --no-http < /tmp/seed_pos_data_orm.py
# =============================================================================

import random
from datetime import datetime, timedelta

random.seed(42)

# ─────────────────────────────────────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────────────────────────────────────
MONTHS_BACK           = 12
BASE_DAILY_AMOUNT     = 3_000    # S/ primer mes
PEAK_DAILY_AMOUNT     = 25_000   # S/ último mes
ORDERS_PER_DAY_MIN    = 4
ORDERS_PER_DAY_MAX    = 12

PRODUCTS_DATA = [
    {"name": "Polo Algodón Pima Blanco",   "price": 45.00,  "sku": "TEX-001"},
    {"name": "Polo Algodón Pima Negro",    "price": 45.00,  "sku": "TEX-002"},
    {"name": "Camiseta Deportiva Dryfit",  "price": 55.00,  "sku": "TEX-003"},
    {"name": "Pantalón Jean Clásico",      "price": 120.00, "sku": "TEX-004"},
    {"name": "Pantalón Drill Beige",       "price": 95.00,  "sku": "TEX-005"},
    {"name": "Vestido Verano Floral",      "price": 85.00,  "sku": "TEX-006"},
    {"name": "Blusa Seda Artificial",      "price": 70.00,  "sku": "TEX-007"},
    {"name": "Chompa Alpaca Andina",       "price": 180.00, "sku": "TEX-008"},
    {"name": "Casaca Impermeable",         "price": 220.00, "sku": "TEX-009"},
    {"name": "Shorts Playa Estampado",     "price": 40.00,  "sku": "TEX-010"},
    {"name": "Medias Pack x3",             "price": 15.00,  "sku": "TEX-011"},
    {"name": "Ropa Interior Pack x3",      "price": 35.00,  "sku": "TEX-012"},
    {"name": "Pijama Algodón Unisex",      "price": 65.00,  "sku": "TEX-013"},
    {"name": "Polo Navideño Estampado",    "price": 50.00,  "sku": "TEX-014"},
    {"name": "Corbata Seda Peruana",       "price": 60.00,  "sku": "TEX-015"},
]

# ─────────────────────────────────────────────────────────────────────────────
#  PASO 1 — Obtener/crear productos
# ─────────────────────────────────────────────────────────────────────────────
print("\n[1/4] Preparando productos...")

uom = env['uom.uom'].search([('name', 'ilike', 'unidad')], limit=1)
if not uom:
    uom = env['uom.uom'].search([], limit=1)

categ = env['product.category'].search([('name', '=', 'All')], limit=1)
if not categ:
    categ = env['product.category'].search([], limit=1)

products = []
for p in PRODUCTS_DATA:
    existing = env['product.product'].search(
        [('default_code', '=', p['sku'])], limit=1
    )
    if existing:
        products.append({'record': existing, 'price': p['price'], 'name': p['name']})
        print(f"  ✓ Existe: {p['name']}")
    else:
        tmpl = env['product.template'].create({
            'name':              p['name'],
            'type':              'product',
            'list_price':        p['price'],
            'standard_price':    p['price'] * 0.4,
            'default_code':      p['sku'],
            'categ_id':          categ.id,
            'uom_id':            uom.id,
            'uom_po_id':         uom.id,
            'available_in_pos':  True,
            'sale_ok':           True,
            'purchase_ok':       True,
        })
        prod = env['product.product'].search(
            [('product_tmpl_id', '=', tmpl.id)], limit=1
        )
        products.append({'record': prod, 'price': p['price'], 'name': p['name']})
        print(f"  + Creado: {p['name']}")

env.cr.commit()
print(f"  Total productos: {len(products)}")

# ─────────────────────────────────────────────────────────────────────────────
#  PASO 2 — Obtener/crear POS Config
# ─────────────────────────────────────────────────────────────────────────────
print("\n[2/4] Preparando configuración POS...")

pos_config = env['pos.config'].search([], limit=1)
if not pos_config:
    journal = env['account.journal'].search(
        [('type', '=', 'cash')], limit=1
    )
    pos_config = env['pos.config'].create({
        'name':       'Punto de Venta Principal',
        'journal_id': journal.id if journal else False,
    })
    print(f"  + POS Config creada: id={pos_config.id}")
else:
    print(f"  ✓ POS Config existente: id={pos_config.id} — {pos_config.name}")

company   = env.company
currency  = company.currency_id
user      = env.user
print(f"  Empresa  : {company.name}")
print(f"  Moneda   : {currency.name}")
print(f"  Usuario  : {user.name}")

# ─────────────────────────────────────────────────────────────────────────────
#  PASO 3 — Generar sesiones y órdenes
# ─────────────────────────────────────────────────────────────────────────────
print("\n[3/4] Generando órdenes POS...")

today          = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
start_date     = today - timedelta(days=MONTHS_BACK * 30)
total_days     = MONTHS_BACK * 30
growth_factor  = (PEAK_DAILY_AMOUNT / BASE_DAILY_AMOUNT) ** (1.0 / total_days)

total_orders   = 0
total_lines    = 0
total_revenue  = 0.0
session_cache  = {}   # "YYYY-MM" → pos.session record
order_seq      = 1
current_date   = start_date
day_index      = 0

while current_date < today:
    if current_date.date() >= today.date():
        break

    # Cerrado domingos
    if current_date.weekday() == 6:
        current_date += timedelta(days=1)
        day_index    += 1
        continue

    # ── Sesión del mes ──────────────────────────────────────────────────────
    month_key = current_date.strftime("%Y-%m")
    if month_key not in session_cache:
        session_name  = f"POS/{current_date.strftime('%Y/%m')}/0001"
        session_start = current_date.replace(day=1, hour=8, minute=0, second=0)
        session_stop  = session_start + timedelta(hours=12)

        # Verificar si ya existe
        existing_session = env['pos.session'].search([
            ('config_id', '=', pos_config.id),
            ('start_at', '>=', session_start.strftime('%Y-%m-01 00:00:00')),
            ('start_at', '<',  session_start.strftime('%Y-%m-28 00:00:00')),
        ], limit=1)

        if existing_session:
            session_cache[month_key] = existing_session
            print(f"  ✓ Sesión existente {month_key}: id={existing_session.id}")
        else:
            new_session = env['pos.session'].create({
                'config_id':  pos_config.id,
                'user_id':    user.id,
                'start_at':   session_start,
                'stop_at':    session_stop,
                'state':      'closed',
            })
            session_cache[month_key] = new_session
            print(f"  + Sesión {month_key}: id={new_session.id}")

    session = session_cache[month_key]

    # ── Presupuesto del día ─────────────────────────────────────────────────
    target_daily  = BASE_DAILY_AMOUNT * (growth_factor ** day_index)
    noise         = random.uniform(0.75, 1.30)
    daily_budget  = target_daily * noise
    n_orders      = random.randint(ORDERS_PER_DAY_MIN, ORDERS_PER_DAY_MAX)

    # Distribuir presupuesto entre órdenes
    order_amounts = []
    remaining     = daily_budget
    for i in range(n_orders):
        if i == n_orders - 1:
            order_amounts.append(max(10.0, remaining))
        else:
            share = remaining * random.uniform(0.05, 0.30)
            order_amounts.append(max(10.0, share))
            remaining -= share

    # ── Crear cada orden ────────────────────────────────────────────────────
    for amount in order_amounts:
        order_hour = random.randint(9, 19)
        order_min  = random.randint(0, 59)
        order_dt   = current_date.replace(hour=order_hour, minute=order_min)

        # Líneas de la orden
        n_lines      = random.randint(1, 4)
        lines_data   = []
        budget_share = amount / n_lines

        for _ in range(n_lines):
            prod = random.choice(products)
            qty  = max(1, round(budget_share / prod['price']))
            unit = round(budget_share / qty, 2)
            sub  = round(unit * qty, 2)

            lines_data.append((0, 0, {
                'product_id':           prod['record'].id,
                'product_uom_id':       uom.id,
                'qty':                  qty,
                'price_unit':           unit,
                'price_subtotal':       sub,
                'price_subtotal_incl':  sub,
                'full_product_name':    prod['name'],
            }))
            total_lines += 1

        order_total = sum(l[2]['price_subtotal_incl'] for l in lines_data)

        env['pos.order'].create({
            'name':             f"POS-{current_date.strftime('%Y%m%d')}-{order_seq:04d}",
            'session_id':       session.id,
            'date_order':       order_dt,
            'state':            'done',
            'amount_total':     round(order_total, 2),
            'amount_tax':       0.0,
            'amount_paid':      round(order_total, 2),
            'amount_return':    0.0,
            'company_id':       company.id,
            'currency_id':      currency.id,
            'lines':            lines_data,
        })

        order_seq    += 1
        total_orders += 1
        total_revenue += order_total

    current_date += timedelta(days=1)
    day_index    += 1

    # Commit cada semana para no perder todo si hay error
    if day_index % 7 == 0:
        env.cr.commit()
        print(f"  ... {current_date.strftime('%Y-%m-%d')} — órdenes: {total_orders:,} — S/ {total_revenue:,.0f}")

# Commit final
env.cr.commit()

# ─────────────────────────────────────────────────────────────────────────────
#  PASO 4 — Resumen
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "=" * 65)
print("  RESUMEN FINAL")
print("=" * 65)
print(f"  ✅ Órdenes POS creadas : {total_orders:,}")
print(f"  ✅ Líneas creadas       : {total_lines:,}")
print(f"  ✅ Ingreso total        : S/ {total_revenue:,.2f}")
dias_habiles = MONTHS_BACK * 26
print(f"  ✅ Promedio diario      : S/ {total_revenue / dias_habiles:,.2f}")
print("=" * 65)
print("\n  Ahora en Odoo:")
print("  🤖 Inteligencia Artificial → Predecir Ventas Futuras")
print("  El gráfico mostrará tendencia claramente CRECIENTE ✅\n")
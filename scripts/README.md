# 📊 Generador de Datos Históricos de Ventas - Odoo

## 🎯 Objetivo
Generar e insertar automáticamente **10,000+ órdenes de POS** distribuidas en **5 años** con:
- ✅ Variaciones realistas diarias/mensuales
- ✅ Factores estacionales de Perú (Fiestas Patrias, Navidad, etc.)
- ✅ Patrones de días de semana
- ✅ Datos listos para predicciones con IA

## 📋 Requisitos

1. **Odoo 16+** con módulo de Punto de Venta (`pos`) activado
2. **Base de datos** con al menos 1 sesión de POS configurada
3. **Permisos de administrador** en Odoo

## 🚀 Método 1: Usando Odoo Shell (Recomendado)

### Paso 1: Ubicar el archivo de configuración
```bash
# Linux/Mac
locate odoo.conf

# Windows: Usualmente en
C:\Program Files\Odoo\odoo.conf
# o
C:\Users\<usuario>\AppData\Local\Odoo\odoo.conf
```

### Paso 2: Ejecutar Odoo Shell
```bash
# Reemplazar valores según tu configuración
odoo shell -d nombre_base_datos -c /path/to/odoo.conf
```

Deberías ver algo como:
```
Python 3.x.x
>>> 
```

### Paso 3: Ejecutar el generador
Copia y pega esto en la terminal:

```python
# Importar la función
import sys
sys.path.insert(0, 'C:\\Users\\acmun\\Documents\\comercial\\addons\\sales\\scripts')

from generate_sales_simple import generate_historical_sales_data

# Ejecutar generación
result = generate_historical_sales_data(env, years=5, total_orders=10000)

# Ver resultado
print(result)
```

### Resultado esperado:
```
======================================================================
🚀 INICIANDO GENERACIÓN DE DATOS HISTÓRICOS
======================================================================
📅 Período: 5 años (1825 días)
📊 Órdenes por día (promedio): 5.48
✓ Insertadas 100 órdenes (Total: 100/10000)
✓ Insertadas 100 órdenes (Total: 200/10000)
...
✅ GENERACIÓN COMPLETADA: 10000 órdenes insertadas
======================================================================
```

## 🔧 Método 2: Desde el Menú de Odoo

### Paso 1: Crear un botón personalizado
Editar archivo: `sales/views/sales_views.xml`

Agregar este código dentro de `<odoo>`:

```xml
<record id="action_generate_historical_sales" model="ir.actions.server">
    <field name="name">Generar Datos Históricos</field>
    <field name="model_id" ref="model_sales_ai_prediction"/>
    <field name="state">code</field>
    <field name="code">
import sys
sys.path.insert(0, '${ADDON_PATH}/scripts')
from generate_sales_simple import generate_historical_sales_data
result = generate_historical_sales_data(env, years=5, total_orders=10000)
    </field>
</record>

<!-- Agregar botón en vista -->
<record id="sales_ai_prediction_form" model="ir.ui.view">
    <field name="name">Sales AI Prediction Form</field>
    <field name="model">sales.ai.prediction</field>
    <field name="arch" type="xml">
        <form>
            <button name="%(action_generate_historical_sales)d" type="action" 
                string="📊 Generar 10k Órdenes Históricas" class="btn-primary"/>
            <!-- resto del formulario -->
        </form>
    </field>
</record>
```

## ⚙️ Personalización

### Cambiar número de órdenes:
```python
result = generate_historical_sales_data(env, years=5, total_orders=20000)  # 20k órdenes
```

### Cambiar período:
```python
result = generate_historical_sales_data(env, years=3, total_orders=10000)  # 3 años
```

### Cambiar años y órdenes juntas:
```python
result = generate_historical_sales_data(env, years=2, total_orders=5000)   # 2 años
```

## 📊 Datos Generados

### Distribución temporal:
- **Primer día de la semana**: Factor 0.7x (menos ventas)
- **Viernes-Sábado**: Factor 1.2x-1.4x (más ventas)
- **Julio (Fiestas Patrias)**: Factor 1.4x
- **Diciembre (Navidad)**: Factor 1.5x
- **Agosto (Invierno)**: Factor 0.8x

### Tipos de compras:
- **50%** pequeñas (S/5 - S/80)
- **35%** medianas (S/80 - S/300)
- **15%** grandes (S/300 - S/1,500)

### Estados:
Todas las órdenes se generan como **"paid"** (pagadas y confirmadas)

## ✅ Verificar los datos inseridos

### Opción 1: Desde Odoo UI
1. Ir a: **Punto de Venta > Órdenes**
2. Aplicar filtro por fecha
3. Deberías ver las órdenes del histórico

### Opción 2: Desde Base de datos
```sql
-- PostgreSQL/MySQL
SELECT COUNT(*) FROM pos_order;
SELECT MIN(date_order), MAX(date_order) FROM pos_order;
SELECT DATE(date_order), COUNT(*) FROM pos_order GROUP BY DATE(date_order) ORDER BY DATE(date_order) DESC LIMIT 10;
```

## 🤖 Usando datos históricos para predicciones

### Paso 1: Ir al módulo de Ventas
**Menú > Ventas > Recomendador con IA**

### Paso 2: Hacer predicción
1. Click en **"Predecir Ventas"**
2. Ver gráficos con datos históricos
3. Los gráficos mostrarán la tendencia de 5 años

### Paso 3: Análisis
- **Tendencia**: ¿Creciente, Decreciente o Estable?
- **Tasa de crecimiento**: % estimado
- **Facturación predicha**: Para próximos 30-90 días

## 📈 Esperado en los gráficos

Con 10,000 órdenes distribuidas en 5 años verás:
- 📊 Línea de tendencia general (crecimiento)
- 📍 Picos en diciembre (Navidad)
- 📍 Picos en julio (Fiestas Patrias)
- 📍 Valles en agosto (Invierno)
- 📍 Variación día a día realista

## 🐛 Troubleshooting

### Error: "ModuleNotFoundError: No module named 'generate_sales_simple'"
```python
# Asegúrate de la ruta correcta
import sys
print(sys.path)
# Agregar ruta manualmente:
sys.path.insert(0, 'C:\\Users\\acmun\\Documents\\comercial\\addons\\sales\\scripts')
```

### Error: "AttributeError: 'pos.order' has no attribute 'create'"
- Verificar que tienes permisos de administrador
- Verificar que el módulo `pos` está instalado

### Datos no visibles en Odoo
- Actualizar pantalla con F5
- Ir a **Punto de Venta > Órdenes** y aplicar filtro "Todas"
- Verificar que el usuario tiene permiso para ver órdenes

## 📝 Nota importante
Los datos generados son **simulados y realistas** pero ficticios. Si necesitas:
- Datos reales de anteriores años: Migrar desde sistema anterior
- Modificar factores estacionales: Editar `seasonal_factors` en `generate_sales_simple.py`
- Agregar productos a las órdenes: Requiere más personalización

---

**¿Preguntas?** Revisa el archivo [generate_sales_simple.py](generate_sales_simple.py) para ver comentarios y personalizar según tus necesidades.

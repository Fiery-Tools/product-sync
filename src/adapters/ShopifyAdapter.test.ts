import { WooAdapter } from './WooAdapter';
import { ShopifyAdapter } from './ShopifyAdapter';

// Mock CanonicalProduct and its variant for type safety in tests
// In a real project, this would be imported from a central models directory.
interface CanonicalVariant {
    canonicalId: string;
    title: string;
    price: number;
    compareAtPrice?: number;
    sku: string;
    inventory: number | null;
    taxable?: boolean;
    requiresShipping?: boolean;
    meta?: any;
}

interface CanonicalProduct {
    id: string;
    title: string;
    description: string;
    images: { src: string }[];
    productType?: string;
    status?: string;
    tags?: string[];
    variants: CanonicalVariant[];
    meta?: any;
}


describe('WooCommerce to Shopify Conversion', () => {
    const wooAdapter = new WooAdapter();
    const shopifyAdapter = new ShopifyAdapter();

    // Sample WooCommerce single product as provided
    const wooProduct = {
        "id": 85,
        "name": "Single",
        "slug": "single",
        "permalink": "https://wordpress.fiery.tools/product/single/",
        "date_created": "2025-09-28T05:11:48",
        "date_created_gmt": "2025-09-28T05:11:48",
        "date_modified": "2025-09-28T05:12:52",
        "date_modified_gmt": "2025-09-28T05:12:52",
        "type": "simple",
        "status": "publish",
        "featured": false,
        "catalog_visibility": "visible",
        "description": "<p>Lorem ipsum dolor sit amet...</p>",
        "short_description": "<p>This is a simple, virtual product.</p>",
        "sku": "woo-single",
        "price": "2",
        "regular_price": "3",
        "sale_price": "2",
        "on_sale": true,
        "purchasable": true,
        "total_sales": 0,
        "virtual": true,
        "downloadable": true,
        "downloads": [],
        "tax_status": "taxable",
        "manage_stock": false,
        "stock_quantity": null,
        "weight": "5",
        "shipping_required": false,
        "reviews_allowed": true,
        "average_rating": "0.00",
        "parent_id": 0,
        "categories": [{
            "id": 20,
            "name": "Music",
            "slug": "music"
        }],
        "tags": [{
            "id": 21,
            "name": "Hot",
            "slug": "hot"
        }],
        "images": [{
            "id": 114,
            "src": "https://wordpress.fiery.tools/wp-content/uploads/2025/09/single-1.jpg",
            "name": "single-1.jpg",
            "alt": ""
        }],
        "attributes": [],
        "variations": [],
        "meta_data": [],
    };

    it('should correctly convert a WooCommerce product to a Shopify product with all attributes', () => {
        // Step 1: Convert from WooCommerce to a universal CanonicalProduct model
        // Note: You will need to add the new properties to your CanonicalProduct model as well.
        const canonicalProduct: CanonicalProduct = {
            id: wooProduct.id.toString(),
            title: wooProduct.name,
            description: `${wooProduct.description}\n${wooProduct.short_description}`,
            images: wooProduct.images,
            productType: wooProduct.categories[0]?.name,
            status: wooProduct.status,
            tags: wooProduct.tags.map(t => t.name),
            variants: [{
                canonicalId: wooProduct.sku,
                title: 'Default Title',
                price: parseFloat(wooProduct.sale_price),
                compareAtPrice: parseFloat(wooProduct.regular_price),
                sku: wooProduct.sku,
                inventory: wooProduct.stock_quantity,
                requiresShipping: !wooProduct.virtual,
                taxable: wooProduct.tax_status === 'taxable'
            }]
        };

        // Step 2: Convert from the CanonicalProduct to the ShopifyProduct model
        const shopifyProduct = shopifyAdapter.toPlatform(canonicalProduct);
        const shopifyVariant = shopifyProduct.variants[0];

        // --- Assertions ---
        expect(shopifyProduct.title).toBe('Single');
        expect(shopifyProduct.body_html).toContain('<p>Lorem ipsum dolor sit amet...</p>');
        expect(shopifyProduct.status).toBe('active');
        expect(shopifyProduct.product_type).toBe('Music');
        expect(shopifyProduct.tags).toBe('Hot');
        expect(shopifyProduct.images[0].src).toBe('https://wordpress.fiery.tools/wp-content/uploads/2025/09/single-1.jpg');

        expect(shopifyProduct.variants).toHaveLength(1);
        expect(shopifyVariant.sku).toBe('woo-single');
        expect(shopifyVariant.price).toBe('2');
        expect(shopifyVariant.compare_at_price).toBe('3');
        expect(shopifyVariant.taxable).toBe(true);
        expect(shopifyVariant.requires_shipping).toBe(false);
        expect(shopifyVariant.inventory_quantity).toBe(0); // null stock quantity should default to 0
    });
});
"use client";

type Product = {
    id: string;
    url: string;
    name: string;
    description: string;
    price: number | null;
    currency: string | null;
    images: string[];
    sku?: string | null;
};

export function ProductTable({ products }: { readonly products: Product[] }) {
    if (products.length === 0) {
        return <div className="empty-state">Awaiting product data</div>;
    }

    return (
        <div className="product-table-wrap">
            <table className="product-table">
                <thead>
                    <tr>
                        <th>Asset</th>
                        <th>Product</th>
                        <th>Price</th>
                    </tr>
                </thead>
                <tbody>
                    {products.map((product) => (
                        <tr key={product.id}>
                            <td>
                                {product.images[0] ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={product.images[0]}
                                        alt={product.name}
                                        className="thumb"
                                    />
                                ) : (
                                    <div className="empty-thumb" />
                                )}
                            </td>
                            <td>
                                <div className="product-name">{product.name}</div>
                                <div className="product-id">{product.sku ?? product.id}</div>
                            </td>
                            <td className="price">
                                {product.price !== null ? `${product.currency ?? ""} ${product.price}` : "--"}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

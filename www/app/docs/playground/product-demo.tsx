"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Heart,
	ShoppingCart,
	Star,
	Plus,
	Minus,
	Share2,
	Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mockAnalytics } from "./analytics-mock";

const PRODUCT = {
	id: "prod_001",
	name: "Premium Wireless Headphones",
	price: 299.99,
	originalPrice: 399.99,
	rating: 4.8,
	reviews: 1247,
	description:
		"Experience studio-quality sound with our flagship wireless headphones. Advanced noise cancellation, 40-hour battery life, and premium comfort.",
	features: [
		"Active Noise Cancellation",
		"40-hour Battery Life",
		"Premium Memory Foam",
		"Hi-Res Audio Certified",
	],
	colors: ["Black", "Silver", "Rose Gold"],
	image: "🎧",
};

export function ProductDemo() {
	const [quantity, setQuantity] = useState(1);
	const [selectedColor, setSelectedColor] = useState(PRODUCT.colors[0]);
	const [isLiked, setIsLiked] = useState(false);
	const [viewCount, setViewCount] = useState(0);

	const handleAddToCart = () => {
		mockAnalytics.track("add_to_cart", {
			product_id: PRODUCT.id,
			product_name: PRODUCT.name,
			price: PRODUCT.price,
			quantity,
			color: selectedColor,
			value: PRODUCT.price * quantity,
			currency: "USD",
		});
	};

	const handleLike = () => {
		const newLikedState = !isLiked;
		setIsLiked(newLikedState);
		mockAnalytics.track(newLikedState ? "product_liked" : "product_unliked", {
			product_id: PRODUCT.id,
			product_name: PRODUCT.name,
		});
	};

	const handleShare = () => {
		mockAnalytics.track("product_shared", {
			product_id: PRODUCT.id,
			product_name: PRODUCT.name,
			method: "copy_link",
		});
	};

	const handleColorChange = (color: string) => {
		setSelectedColor(color);
		mockAnalytics.track("color_selected", {
			product_id: PRODUCT.id,
			color,
		});
	};

	const handleQuantityChange = (delta: number) => {
		const newQuantity = Math.max(1, Math.min(10, quantity + delta));
		if (newQuantity !== quantity) {
			setQuantity(newQuantity);
			mockAnalytics.track("quantity_changed", {
				product_id: PRODUCT.id,
				old_quantity: quantity,
				new_quantity: newQuantity,
			});
		}
	};

	const handleViewDetails = () => {
		setViewCount((prev) => prev + 1);
		mockAnalytics.track("view_product_details", {
			product_id: PRODUCT.id,
			product_name: PRODUCT.name,
			view_count: viewCount + 1,
		});
	};

	return (
		<Card className="h-full overflow-hidden">
			<div className="p-4 space-y-4">
				{/* Product Image */}
				<div className="relative aspect-video bg-muted/50 rounded-lg flex items-center justify-center border">
					<div className="text-5xl">{PRODUCT.image}</div>
					<div className="absolute top-2 right-2 flex gap-1.5">
						<Button
							size="sm"
							variant="outline"
							className={cn(
								"rounded-full backdrop-blur-sm h-7 w-7 p-0",
								isLiked &&
									"bg-destructive/10 text-destructive border-destructive/20",
							)}
							onClick={handleLike}
						>
							<Heart className={cn("h-3 w-3", isLiked && "fill-current")} />
						</Button>
						<Button
							size="sm"
							variant="outline"
							className="rounded-full backdrop-blur-sm h-7 w-7 p-0"
							onClick={handleShare}
						>
							<Share2 className="h-3 w-3" />
						</Button>
					</div>
					<Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground border-0 text-xs px-2 py-0.5">
						25% OFF
					</Badge>
				</div>

				{/* Product Info */}
				<div className="space-y-3">
					<div>
						<h2 className="text-lg font-bold">{PRODUCT.name}</h2>
						<div className="flex items-center gap-2 mt-1">
							<div className="flex items-center gap-0.5">
								{[0, 1, 2, 3, 4].map((i) => (
								<Star
									key={i}
									className={cn(
										"h-3 w-3",
										i < Math.floor(PRODUCT.rating)
											? "fill-primary text-primary"
											: "text-muted",
									)}
								/>
							))}
							</div>
							<span className="text-xs text-muted-foreground">
								{PRODUCT.rating} ({PRODUCT.reviews})
							</span>
						</div>
					</div>

					<div className="flex items-baseline gap-2">
						<span className="text-2xl font-bold">${PRODUCT.price}</span>
						<span className="text-sm text-muted-foreground line-through">
							${PRODUCT.originalPrice}
						</span>
					</div>

					<p className="text-xs text-muted-foreground line-clamp-2">
						{PRODUCT.description}
					</p>

					{/* Color Selection */}
					<div className="space-y-1.5">
						<label htmlFor="color-select" className="text-xs font-medium">Color</label>
						<Select value={selectedColor} onValueChange={handleColorChange}>
							<SelectTrigger id="color-select">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{PRODUCT.colors.map((color) => (
									<SelectItem key={color} value={color}>
										{color}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Quantity */}
					<div className="space-y-1.5">
						<label htmlFor="quantity-input" className="text-xs font-medium">Quantity</label>
						<div className="flex items-center gap-2">
							<Button
								size="sm"
								variant="outline"
								className="h-8 w-8 p-0"
								onClick={() => handleQuantityChange(-1)}
								disabled={quantity <= 1}
							>
								<Minus className="h-3 w-3" />
							</Button>
							<Input
								id="quantity-input"
								type="number"
								value={quantity}
								readOnly
								className="w-16 text-center h-8 text-sm"
							/>
							<Button
								size="sm"
								variant="outline"
								className="h-8 w-8 p-0"
								onClick={() => handleQuantityChange(1)}
								disabled={quantity >= 10}
							>
								<Plus className="h-3 w-3" />
							</Button>
						</div>
					</div>

					{/* Actions */}
					<div className="space-y-1.5">
						<Button className="w-full" size="sm" onClick={handleAddToCart}>
							<ShoppingCart className="h-3 w-3 mr-2" />
							Add to Cart - ${(PRODUCT.price * quantity).toFixed(2)}
						</Button>
						<Button
							variant="outline"
							className="w-full"
							size="sm"
							onClick={handleViewDetails}
						>
							<Eye className="h-3 w-3 mr-2" />
							View Details {viewCount > 0 && `(${viewCount})`}
						</Button>
					</div>
				</div>
			</div>
		</Card>
	);
}

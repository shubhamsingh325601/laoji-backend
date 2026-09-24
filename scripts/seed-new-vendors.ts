import 'dotenv/config';
import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, inArray } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import * as dns from 'dns/promises';
import { parse } from 'pg-connection-string';
import {
  users,
  vendors,
  restaurants,
  menuCategories,
  menuItems,
  menuItemVariants,
  menuItemAddons,
  categories,
  products,
  vendorProducts,
} from '../drizzle/schema';

interface ItemSpec {
  name: string;
  desc: string;
  price: number;
  half?: number;
  full?: number;
  isVeg?: boolean;
  unit?: string;
  hasStandardAddons?: boolean;
}

interface CategorySpec {
  category: string;
  image: string;
  masterCat: string;
  items: ItemSpec[];
}

interface VendorDataSpec {
  businessName: string;
  ownerName: string;
  phone: string;
  passwordPlain: string;
  shopAddress: string;
  pickupLat: number;
  pickupLng: number;
  cuisineTags: string;
  restaurantImage: string;
  standardAddons?: { name: string; price: number }[];
  categories: CategorySpec[];
}

const VENDORS_DATA: VendorDataSpec[] = [
  // 1. Chaska Point Cafe
  {
    businessName: 'Chaska Point Cafe',
    ownerName: 'Naman Kumawat',
    phone: '9571660837',
    passwordPlain: 'ChaskaPoint@123',
    shopAddress: 'Bapawar Road, SR Hotel Ke Piche, Sangod, Rajasthan 325601',
    pickupLat: 24.918,
    pickupLng: 76.285,
    cuisineTags: 'Cafe, Fast Food, Pizza, Burgers, Shakes, Beverages, Chinese, Snacks',
    restaurantImage: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800',
    standardAddons: [
      { name: 'Extra Cheese', price: 10 },
      { name: 'Extra Mayo', price: 10 },
      { name: 'Extra Paneer', price: 20 },
    ],
    categories: [
      {
        category: 'Chai',
        image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500',
        masterCat: 'Beverages & Chai',
        items: [
          { name: 'Adrak Chai', desc: 'Fresh ginger infused aromatic Indian tea (अदरक चाय)', price: 20 },
          { name: 'Special Chai', desc: 'House special rich creamy milk tea (स्पेशल चाय)', price: 25 },
          { name: 'Masala Chai', desc: 'Traditional spiced aromatic Indian chai (मसाला चाय)', price: 25 },
          { name: 'Green Tea', desc: 'Light refreshing healthy green tea (ग्रीन टी)', price: 25 },
        ],
      },
      {
        category: 'Coffee',
        image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500',
        masterCat: 'Beverages & Coffee',
        items: [
          { name: 'Hot Coffee', desc: 'Steaming rich espresso blend with milk (हॉट कॉफी)', price: 30 },
          { name: 'Cold Coffee', desc: 'Chilled creamy blended thick coffee (कोल्ड कॉफी)', price: 70 },
          { name: 'Cappuccino', desc: 'Rich frothy Italian style coffee (कैपुचिनो)', price: 59 },
        ],
      },
      {
        category: 'Cold Drinks',
        image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500',
        masterCat: 'Beverages & Cold Drinks',
        items: [
          { name: 'Fresh Lime Soda', desc: 'Zesty lime soda served sweet or salted (फ्रेश लाइम सोडा)', price: 20 },
          { name: 'Fresh Lime Water', desc: 'Refreshing lemon water (फ्रेश लाइम वॉटर)', price: 20 },
          { name: 'Coke / Sprite / Fanta', desc: 'Chilled refreshing soft drink 250ml (कोल्ड ड्रिंक)', price: 20 },
          { name: 'Mineral Water', desc: 'Packaged chilled drinking water bottle (मिनरल वॉटर)', price: 20 },
        ],
      },
      {
        category: 'Mocktails',
        image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500',
        masterCat: 'Beverages & Mocktails',
        items: [
          { name: 'Blue Curacao Mojito', desc: 'Sparkling citrus curacao cooler with mint (ब्लू कुराकाओ मोजिटो)', price: 60 },
          { name: 'Green Apple Mojito', desc: 'Crisp green apple flavored sparkling mint cooler (ग्रीन एप्पल मोजिटो)', price: 60 },
          { name: 'Watermelon Mojito', desc: 'Refreshing watermelon and fresh mint cooler (वाटरमेलन मोजिटो)', price: 60 },
          { name: 'Mint Mojito', desc: 'Classic zesty lime and fresh mint cooler (मिंट मोजिटो)', price: 60 },
        ],
      },
      {
        category: 'Shakes',
        image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500',
        masterCat: 'Beverages & Shakes',
        items: [
          { name: 'Chocolate Shake', desc: 'Rich thick milkshake with chocolate syrup (चॉकलेट शेक)', price: 70 },
          { name: 'Strawberry Shake', desc: 'Sweet and creamy thick strawberry shake (स्ट्रॉबेरी शेक)', price: 70 },
          { name: 'Vanilla Shake', desc: 'Smooth classic thick vanilla shake (वैनिला शेक)', price: 70 },
          { name: 'Oreo Shake', desc: 'Creamy shake loaded with crunchy Oreo cookies (ओरियो शेक)', price: 80 },
          { name: 'Butterscotch Shake', desc: 'Rich butterscotch caramel thick shake (बटरस्कॉच शेक)', price: 70 },
          { name: 'Mango Shake', desc: 'Luscious tropical mango milkshake (मैंगो शेक)', price: 70 },
          { name: 'KitKat Shake', desc: 'Decadent shake blended with KitKat crunch (किटकेट शेक)', price: 80 },
          { name: 'Pineapple Shake', desc: 'Tangy and sweet tropical pineapple shake (पाइनएप्पल शेक)', price: 70 },
        ],
      },
      {
        category: 'Burgers',
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500',
        masterCat: 'Burgers & Fast Food',
        items: [
          { name: 'Veg Burger', desc: 'Crispy vegetable patty with fresh veggies and house sauce (वेज बर्गर)', price: 40, hasStandardAddons: true },
          { name: 'Cheese Burger', desc: 'Veg burger topped with melted cheese slice (चीज बर्गर)', price: 50, hasStandardAddons: true },
          { name: 'Aloo Tikki Burger', desc: 'Golden spiced potato patty burger (आलू टिक्की बर्गर)', price: 50, hasStandardAddons: true },
          { name: 'Tandoori Paneer Burger', desc: 'Marinated paneer slab with spicy tandoori sauce (तंदूरी पनीर बर्गर)', price: 70, hasStandardAddons: true },
          { name: 'Maharaja Burger', desc: 'Jumbo burger loaded with extra veggies and toppings (महाराजा बर्गर)', price: 70, hasStandardAddons: true },
          { name: 'Mayonnaise Burger', desc: 'Loaded with rich creamy seasoned mayonnaise (मेयोनीज बर्गर)', price: 60, hasStandardAddons: true },
          { name: 'Double Patty Burger', desc: 'Loaded with two crispy patties and double sauce (डबल पैटी बर्गर)', price: 90, hasStandardAddons: true },
        ],
      },
      {
        category: 'Sandwiches',
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500',
        masterCat: 'Sandwiches & Fast Food',
        items: [
          { name: 'Veg Sandwich', desc: 'Fresh cucumber, tomato and mint chutney sandwich (वेज सैंडविच)', price: 40, hasStandardAddons: true },
          { name: 'Cheese Sandwich', desc: 'Classic toasted sandwich with melted cheese (चीज सैंडविच)', price: 50, hasStandardAddons: true },
          { name: 'Masala Sandwich', desc: 'Spicy potato masala toasted sandwich (मसाला सैंडविच)', price: 50, hasStandardAddons: true },
          { name: 'Burger Sandwich', desc: 'Fusion patty sandwich with house sauce (बर्गर सैंडविच)', price: 50, hasStandardAddons: true },
          { name: 'Aloo Sandwich', desc: 'Savory spiced potato filling toasted golden (आलू सैंडविच)', price: 50, hasStandardAddons: true },
          { name: 'Paneer Sandwich', desc: 'Loaded with soft cottage cheese and chutney (पनीर सैंडविच)', price: 70, hasStandardAddons: true },
          { name: 'Grill Sandwich', desc: 'Golden crisp grilled sandwich with seasoned filling (ग्रिल सैंडविच)', price: 70, hasStandardAddons: true },
        ],
      },
      {
        category: 'Patties',
        image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500',
        masterCat: 'Snacks & Patties',
        items: [
          { name: 'Masala Patties', desc: 'Flaky baked puff pastry stuffed with spiced potato (मसाला पैटीज)', price: 30, hasStandardAddons: true },
          { name: 'Cheese Patties', desc: 'Flaky baked puff loaded with melted cheese (चीज पैटीज)', price: 40, hasStandardAddons: true },
          { name: 'Pizza Patties', desc: 'Puff pastry stuffed with pizza sauce, veggies and cheese (पिज़्ज़ा पैटीज)', price: 60, hasStandardAddons: true },
          { name: 'Tandoori Patties', desc: 'Flaky puff filled with smoky tandoori spiced masala (तंदूरी पैटीज)', price: 50, hasStandardAddons: true },
          { name: 'Paneer Patties', desc: 'Puff pastry stuffed with seasoned cottage cheese (पनीर पैटीज)', price: 50, hasStandardAddons: true },
          { name: 'Mayo Patties', desc: 'Crisp puff pastry loaded with creamy mayonnaise (मेयो पैटीज)', price: 35, hasStandardAddons: true },
        ],
      },
      {
        category: 'Rolls',
        image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500',
        masterCat: 'Rolls & Wraps',
        items: [
          { name: 'Spring Roll', desc: 'Crispy fried vegetable spring roll (स्प्रिंग रोल)', price: 80, hasStandardAddons: true },
          { name: 'Veg Roll', desc: 'Warm roll filled with seasoned garden veggies (वेज रोल)', price: 60, hasStandardAddons: true },
          { name: 'Paneer Roll', desc: 'Soft kathi wrap stuffed with spiced paneer (पनीर रोल)', price: 70, hasStandardAddons: true },
          { name: 'Aloo Tikki Roll', desc: 'Spiced potato tikki wrap with onions and chutneys (आलू टिक्की रोल)', price: 60, hasStandardAddons: true },
          { name: 'Schezwan Roll', desc: 'Spicy Schezwan sauce tossed veggie wrap (शेजवान रोल)', price: 60, hasStandardAddons: true },
          { name: 'Tandoori Paneer Roll', desc: 'Charred tandoori paneer roll with mint chutney (तंदूरी पनीर रोल)', price: 80, hasStandardAddons: true },
          { name: 'Paneer Malai Roll', desc: 'Soft paneer cubes rolled in creamy mild malai sauce (पनीर मलाई रोल)', price: 80, hasStandardAddons: true },
          { name: 'Malai Chaap Roll', desc: 'Soya chaap tossed in rich creamy sauce in warm roll (मलाई चाप रोल)', price: 80, hasStandardAddons: true },
        ],
      },
      {
        category: 'Fries',
        image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=500',
        masterCat: 'Fast Food & Fries',
        items: [
          { name: 'French Fries', desc: 'Crispy golden potato fries seasoned with sea salt (फ्रेंच फ्राइज)', price: 60 },
          { name: 'Peri-Peri Fries', desc: 'Fries dusted with spicy African peri-peri seasoning (पेरी पेरी फ्राइज)', price: 70 },
          { name: 'Cheese Fries', desc: 'Crispy fries smothered in velvety melted cheese (चीज फ्राइज)', price: 80 },
          { name: 'Masala Fries', desc: 'Fries tossed in spicy tangy chaat masala (मसाला फ्राइज)', price: 60 },
        ],
      },
      {
        category: 'Momos',
        image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=500',
        masterCat: 'Fast Food & Momos',
        items: [
          { name: 'Veg Momos', desc: 'Steamed dumplings filled with savory minced veggies (वेज मोमोज)', price: 50 },
          { name: 'Masala Momos', desc: 'Momos tossed in spicy aromatic tawa masala (मसाला मोमोज)', price: 60 },
          { name: 'Fried Momos', desc: 'Golden crispy deep-fried momos with spicy red dip (फ्राइड मोमोज)', price: 60 },
        ],
      },
      {
        category: 'Snacks / Starters',
        image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500',
        masterCat: 'Snacks & Starters',
        items: [
          { name: 'Cheese Ball', desc: 'Crispy golden fried molten cheese balls (चीज बॉल)', price: 99 },
          { name: 'Stick Ball', desc: 'Crunchy skewer starter bites (स्टिक बॉल)', price: 99 },
          { name: 'Spring Roll Platter', desc: 'Crispy fried vegetable spring rolls with sauce (स्प्रिंग रोल प्लेटर)', price: 99 },
          { name: 'Bread Pakoda', desc: 'Deep-fried bread fritter stuffed with spiced aloo (ब्रेड पकोड़ा)', price: 60 },
          { name: 'Aloo Bada', desc: 'Traditional spiced potato fritter fried crisp (आलू बड़ा)', price: 40 },
          { name: 'Paneer Pakoda', desc: 'Cottage cheese dipped in spiced gram flour batter (पनीर पकोड़ा)', price: 80 },
          { name: 'Corn Pakoda', desc: 'Crispy sweet corn fritters (कॉर्न पकोड़ा)', price: 60 },
          { name: 'Cheese Pakoda', desc: 'Melted cheese cubes fried in crispy golden batter (चीज पकोड़ा)', price: 99 },
          { name: 'Veg Pakoda', desc: 'Assorted seasonal crispy vegetable fritters (वेज पकोड़ा)', price: 60 },
        ],
      },
      {
        category: 'Pizza',
        image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500',
        masterCat: 'Pizzas & Italian',
        items: [
          { name: 'Margherita Pizza', desc: 'Classic tomato herb sauce and 100% mozzarella cheese (मार्गरिटा पिज़्ज़ा)', price: 99, hasStandardAddons: true },
          { name: 'Farm House Pizza', desc: 'Capsicum, onions, tomatoes and mushrooms with cheese (फार्म हाउस पिज़्ज़ा)', price: 120, hasStandardAddons: true },
          { name: 'Veggie Delight Pizza', desc: 'Loaded with crunchy fresh garden vegetables (वेज डिलाइट पिज़्ज़ा)', price: 130, hasStandardAddons: true },
          { name: 'Corn & Cheese Pizza', desc: 'Juicy golden sweet corn with double mozzarella (कॉर्न एंड चीज पिज़्ज़ा)', price: 140, hasStandardAddons: true },
          { name: 'Tandoori Paneer Pizza', desc: 'Topped with spicy marinated paneer cubes (तंदूरी पनीर पिज़्ज़ा)', price: 150, hasStandardAddons: true },
          { name: 'American Green Wave', desc: 'Onions, crisp green capsicum, and mozzarella (अमेरिकन ग्रीन वेव)', price: 160, hasStandardAddons: true },
          { name: 'Cheese Burst Pizza', desc: 'Crust bursting with rich molten liquid cheese (चीज बर्स्ट पिज़्ज़ा)', price: 160, hasStandardAddons: true },
          { name: 'Double Cheese Margherita', desc: 'Double layer of melted mozzarella cheese (डबल चीज मार्गरिटा)', price: 160, hasStandardAddons: true },
          { name: 'Italian Delight Pizza', desc: 'Herbed Italian tomato base with signature toppings (इटैलियन डिलाइट पिज़्ज़ा)', price: 170, hasStandardAddons: true },
          { name: 'Spicy Veggie Pizza', desc: 'Fiery green chilies, paprika, capsicum & onions (स्पाइसी वेज पिज़्ज़ा)', price: 160, hasStandardAddons: true },
          { name: 'Cheese Corn Pizza', desc: 'Loaded sweet corn with extra melted cheese (चीज कॉर्न पिज़्ज़ा)', price: 160, hasStandardAddons: true },
          { name: 'Garlic Bread', desc: 'Toasted baguette brushed with garlic herb butter (गार्लिक ब्रेड)', price: 70 },
          { name: 'Cheese Garlic Bread', desc: 'Garlic bread smothered with melted mozzarella (चीज गार्लिक ब्रेड)', price: 80 },
        ],
      },
      {
        category: 'Pasta',
        image: 'https://images.unsplash.com/photo-1621996346565-e3d5d62816ef?w=500',
        masterCat: 'Pasta & Italian',
        items: [
          { name: 'Red Sauce Pasta', desc: 'Penne in tangy spicy tomato basil arrabbiata sauce (रेड सॉस पास्ता)', price: 99 },
          { name: 'White Sauce Pasta', desc: 'Creamy Alfredo penne with herbs and cheese (व्हाइट सॉस पास्ता)', price: 99 },
          { name: 'Mix Sauce Pasta', desc: 'Pink sauce fusion of rich tomato and creamy Alfredo (मिक्स सॉस पास्ता)', price: 110 },
          { name: 'Peri Peri Pasta', desc: 'Penne tossed in fiery peri-peri seasoning (पेरी पेरी पास्ता)', price: 99 },
          { name: 'Baked Cheesy Pasta', desc: 'Pasta baked under a golden crust of molten cheese (बेक्ड चीजी पास्ता)', price: 120 },
        ],
      },
      {
        category: 'Maggi',
        image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500',
        masterCat: 'Fast Food & Maggi',
        items: [
          { name: 'Veg Maggi', desc: 'Classic noodles cooked with garden vegetables (वेज मैगी)', price: 40, hasStandardAddons: true },
          { name: 'Masala Maggi', desc: 'Maggi noodles tossed with extra spiced tadka (मसाला मैगी)', price: 40, hasStandardAddons: true },
          { name: 'Cheese Maggi', desc: 'Maggi topped with melted cheddar & mozzarella (चीज मैगी)', price: 60, hasStandardAddons: true },
          { name: 'Corn Maggi', desc: 'Maggi tossed with sweet corn kernels (कॉर्न मैगी)', price: 60, hasStandardAddons: true },
          { name: 'Butter Maggi', desc: 'Maggi prepared with a generous dollop of butter (बटर मैगी)', price: 60, hasStandardAddons: true },
          { name: 'Peri Peri Maggi', desc: 'Zesty noodles seasoned with fiery peri-peri herbs (पेरी पेरी मैगी)', price: 60, hasStandardAddons: true },
        ],
      },
      {
        category: 'Chowmein & Noodles',
        image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500',
        masterCat: 'Chinese & Noodles',
        items: [
          { name: 'Veg Chowmein', desc: 'Wok tossed noodles with shredded vegetables (वेज चाऊमीन)', price: 50, hasStandardAddons: true },
          { name: 'Hakka Noodles', desc: 'Classic Indo-Chinese style seasoned wok noodles (हक्का नूडल्स)', price: 60, hasStandardAddons: true },
          { name: 'Schezwan Noodles', desc: 'Spicy noodles tossed in pungent Schezwan sauce (शेजवान नूडल्स)', price: 60, hasStandardAddons: true },
          { name: 'Paneer Hakka Noodles', desc: 'Hakka noodles tossed with soft spiced paneer cubes (पनीर हक्का नूडल्स)', price: 70, hasStandardAddons: true },
          { name: 'Paneer Schezwan Noodles', desc: 'Fiery Schezwan noodles with tender paneer cubes (पनीर शेजवान नूडल्स)', price: 70, hasStandardAddons: true },
          { name: 'Chilli Garlic Noodles', desc: 'Aromatic spicy noodles infused with fried garlic (चिली गार्लिक नूडल्स)', price: 80, hasStandardAddons: true },
        ],
      },
      {
        category: 'Fried Rice',
        image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500',
        masterCat: 'Chinese & Rice',
        items: [
          { name: 'Veg Fried Rice', desc: 'Stir-fried basmati rice with crunchy garden vegetables (वेज फ्राइड राइस)', price: 60 },
          { name: 'Paneer Fried Rice', desc: 'Fluffy fried rice tossed with spiced paneer cubes (पनीर फ्राइड राइस)', price: 80 },
          { name: 'Schezwan Fried Rice', desc: 'Spicy wok-tossed rice with zesty Schezwan sauce (शेजवान फ्राइड राइस)', price: 80 },
        ],
      },
      {
        category: 'Chinese Specialties',
        image: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=500',
        masterCat: 'Chinese & Appetizers',
        items: [
          { name: 'Veg Manchurian (Gravy)', desc: 'Vegetable dumplings simmered in savory dark garlic gravy (वेज मंचूरियन ग्रेवी)', price: 99 },
          { name: 'Veg Manchurian (Dry)', desc: 'Crisp vegetable balls tossed in spicy dry sauce (वेज मंचूरियन ड्राई)', price: 99 },
          { name: 'Paneer Manchurian (Gravy)', desc: 'Soft paneer cubes in savory dark Manchurian gravy (पनीर मंचूरियन ग्रेवी)', price: 110 },
          { name: 'Paneer Manchurian (Dry)', desc: 'Crispy paneer bites coated in tangy dark sauce (पनीर मंचूरियन ड्राई)', price: 110 },
          { name: 'Chilli Paneer', desc: 'Crispy paneer tossed with capsicum, onions & soy chili (चिली पनीर)', price: 99 },
          { name: 'Crispy Corn', desc: 'Golden fried sweet corn kernels tossed with spices (क्रिस्पी कॉर्न)', price: 99 },
          { name: 'Mushroom Chilli', desc: 'Tender mushrooms stir-fried with peppers and spicy sauce (मशरूम चिली)', price: 99 },
          { name: 'American Chopsuey', desc: 'Crispy fried noodles topped with sweet & sour gravy (अमेरिकन चापसूई)', price: 99 },
        ],
      },
      {
        category: 'Soup',
        image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=500',
        masterCat: 'Soups & Appetizers',
        items: [
          { name: 'Manchow Soup', desc: 'Dark spicy vegetable soup with crispy fried noodles (मंचाउ सूप)', price: 60 },
          { name: 'Hot & Sour Soup', desc: 'Tangy and spicy thick vegetable broth (हॉट एंड सोर सूप)', price: 60 },
          { name: 'Lemon Coriander Soup', desc: 'Clear refreshing broth flavored with lemon and coriander (लेमन कोरिएंडर सूप)', price: 60 },
          { name: 'Sweet Corn Soup', desc: 'Comforting creamy soup with sweet corn kernels (स्वीट कॉर्न सूप)', price: 60 },
        ],
      },
      {
        category: 'Desserts',
        image: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=500',
        masterCat: 'Desserts & Ice Cream',
        items: [
          { name: 'Ice Cream Scoop', desc: 'Chilled creamy vanilla ice cream scoop (आइसक्रीम स्कूप)', price: 40 },
          { name: 'Butterscotch Scoop', desc: 'Rich butterscotch ice cream with caramel crunch (बटरस्कॉच स्कूप)', price: 40 },
        ],
      },
    ],
  },

  // 2. Om Misthan Bhandar (Ganga Bishan Ji Ki Dukan)
  {
    businessName: 'Om Misthan Bhandar (Ganga Bishan Ji Ki Dukan)',
    ownerName: 'Madan Mohan Kumawat',
    phone: '8209202625',
    passwordPlain: 'OmMisthan@123',
    shopAddress: 'Gandhi Circle, Sangod, Rajasthan 325601',
    pickupLat: 24.92,
    pickupLng: 76.281,
    cuisineTags: 'Sweets, Mithai, Kachori, Samosa, Namkeen, Rajasthani, Street Food',
    restaurantImage: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=800',
    categories: [
      {
        category: 'Kachori & Samosa Special',
        image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500',
        masterCat: 'Kachori & Snacks',
        items: [
          { name: 'Kota Hing Dal Kachori', desc: 'World-famous Kota crispy dal kachori with strong hing aroma (कोटा हींग दाल कचौरी)', price: 15, unit: '1 piece' },
          { name: 'Special Pyaaz Kachori', desc: 'Flaky Rajasthani kachori stuffed with spiced caramelized onions (स्पेशल प्याज कचौरी)', price: 20, unit: '1 piece' },
          { name: 'Aloo Matar Samosa', desc: 'Crispy golden triangular pastry filled with spiced potato and peas (आलू समोसा)', price: 15, unit: '1 piece' },
          { name: 'Paneer Samosa', desc: 'Flaky crust stuffed with cottage cheese cubes and fragrant spices (पनीर समोसा)', price: 25, unit: '1 piece' },
          { name: 'Rajasthani Mirchi Vada', desc: 'Large bhavnagri chili stuffed with spiced potato mash and fried crisp (मिर्ची वड़ा)', price: 20, unit: '1 piece' },
          { name: 'Special Bread Pakoda', desc: 'Deep-fried bread sandwich coated in savory spiced besan (ब्रेड पकोड़ा)', price: 20, unit: '1 piece' },
        ],
      },
      {
        category: 'Traditional Sweets & Mithai',
        image: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=500',
        masterCat: 'Traditional Sweets & Mithai',
        items: [
          { name: 'Desi Ghee Jalebi', desc: 'Crispy coiled saffron jalebis soaked in warm cardamom syrup (देसी घी जलेबी)', price: 140, half: 140, full: 280, unit: '500g / 1kg' },
          { name: 'Gulab Jamun', desc: 'Melt-in-mouth soft khoya dumplings soaked in rose cardamom syrup (गुलाब जामुन)', price: 150, half: 150, full: 300, unit: '500g / 1kg' },
          { name: 'Rasgulla', desc: 'Traditional spongy cottage cheese balls in light sugar syrup (रसगुल्ला)', price: 140, half: 140, full: 280, unit: '500g / 1kg' },
          { name: 'Kaju Katli', desc: 'Pure diamond cut cashew nut fudge with edible silver vark (काजू कतली)', price: 425, half: 425, full: 850, unit: '500g / 1kg' },
          { name: 'Special Mawa Barfi', desc: 'Classic rich solidified milk barfi with pistachios (मावा बर्फी)', price: 210, half: 210, full: 420, unit: '500g / 1kg' },
          { name: 'Rajasthani Milk Cake', desc: 'Grainy caramelized slow-cooked milk confection (मिल्क केक)', price: 225, half: 225, full: 450, unit: '500g / 1kg' },
          { name: 'Besan Ke Laddu', desc: 'Aromatic roasted gram flour and pure desi ghee laddus (बेसन लड्डू)', price: 170, half: 170, full: 340, unit: '500g / 1kg' },
          { name: 'Motichoor Laddu', desc: 'Delicate tiny chickpea pearls simmered in pure ghee and syrup (मोतीचूर लड्डू)', price: 160, half: 160, full: 320, unit: '500g / 1kg' },
          { name: 'Mathura Peda', desc: 'Traditional caramelized mawa peda dusted with sugar (मथुरा पेड़ा)', price: 200, half: 200, full: 400, unit: '500g / 1kg' },
        ],
      },
      {
        category: 'Namkeen & Farsan',
        image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500',
        masterCat: 'Namkeen & Farsan',
        items: [
          { name: 'Ratlami Sev', desc: 'Signature spicy clove and black pepper crispy chickpea sev (रतलामी सेव)', price: 120, half: 120, full: 240, unit: '500g / 1kg' },
          { name: 'Ujjaini Sev', desc: 'Mild and crunchy gram flour noodles, perfect for daily tea time (उज्जैनी सेव)', price: 110, half: 110, full: 220, unit: '500g / 1kg' },
          { name: 'Khatta Meetha Mixture', desc: 'Tangy and sweet mixture with sev, peanuts and boondi (खट्टा मीठा मिक्सचर)', price: 120, half: 120, full: 240, unit: '500g / 1kg' },
          { name: 'Besan Papdi', desc: 'Crunchy carom (ajwain) flavored besan wafers (बेसन पापड़ी)', price: 110, half: 110, full: 220, unit: '500g / 1kg' },
          { name: 'Masala Boondi', desc: 'Spiced crispy fried chickpea pearls for raita & snacking (मसाला बूंदी)', price: 110, half: 110, full: 220, unit: '500g / 1kg' },
          { name: 'Rajasthani Bhujia', desc: 'Authentic crisp moth bean flour bhujia namkeen (राजस्थानी भुजिया)', price: 130, half: 130, full: 260, unit: '500g / 1kg' },
        ],
      },
    ],
  },

  // 3. The Evening Bites (Cloud Kitchen)
  {
    businessName: 'The Evening Bites',
    ownerName: 'Shakshi Kanwar',
    phone: '6378756442',
    passwordPlain: 'EveningBites@123',
    shopAddress: 'Purana Bazar, Sangod, Rajasthan 325601',
    pickupLat: 24.922,
    pickupLng: 76.279,
    cuisineTags: 'Cloud Kitchen, Fast Food, Burgers, Sandwiches, Rolls, Quick Bites',
    restaurantImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
    categories: [
      {
        category: 'Burgers & Sandwiches',
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500',
        masterCat: 'Burgers & Fast Food',
        items: [
          { name: 'Classic Veg Burger', desc: 'Crispy vegetable patty with fresh veggies and house sauce', price: 49 },
          { name: 'Cheesy Veggie Burger', desc: 'Veggie patty topped with melted cheese slice and herbs', price: 69 },
          { name: 'Crispy Paneer Burger', desc: 'Spiced paneer patty fried crisp with tandoori mayo', price: 79 },
          { name: 'Bombay Masala Grilled Sandwich', desc: 'Layered potato masala, cucumber, tomato and green chutney', price: 59 },
          { name: 'Corn & Cheese Grilled Sandwich', desc: 'Sweet golden corn and melted mozzarella grilled golden', price: 69 },
          { name: 'Paneer Tikka Grilled Sandwich', desc: 'Smoky tandoori paneer filling toasted to perfection', price: 79 },
        ],
      },
      {
        category: 'Rolls & Wraps',
        image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=500',
        masterCat: 'Rolls & Wraps',
        items: [
          { name: 'Crispy Veggie Roll', desc: 'Assorted spiced vegetables wrapped in a warm flaky paratha', price: 59 },
          { name: 'Schezwan Paneer Roll', desc: 'Fiery Schezwan spiced paneer wrapped with crunchy bell peppers', price: 79 },
          { name: 'Cheesy Corn Roll', desc: 'Gooey melted cheese and sweet corn wrapped fresh', price: 69 },
        ],
      },
      {
        category: 'Evening Snacks & Quick Bites',
        image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=500',
        masterCat: 'Snacks & Quick Bites',
        items: [
          { name: 'Peri Peri French Fries', desc: 'Crisp golden fries dusted in zesty African peri-peri spice', price: 69 },
          { name: 'Cheesy French Fries', desc: 'Hot french fries smothered with rich molten cheese sauce', price: 79 },
          { name: 'Steamed Veg Momos (6 Pcs)', desc: 'Freshly steamed dumplings filled with spiced minced veggies', price: 49 },
          { name: 'Crispy Fried Momos (6 Pcs)', desc: 'Golden deep-fried momos served with fiery chili garlic dip', price: 59 },
          { name: 'Cheesy Corn Balls (6 Pcs)', desc: 'Crispy fried golden bites oozing with molten mozzarella', price: 89 },
        ],
      },
      {
        category: 'Maggi & Pasta',
        image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500',
        masterCat: 'Pasta & Maggi',
        items: [
          { name: 'Desi Butter Masala Maggi', desc: 'Classic Maggi noodles cooked with butter and aromatic vegetables', price: 49 },
          { name: 'Melted Cheese Maggi', desc: 'Maggi noodles topped with gooey melted cheese', price: 59 },
          { name: 'Red Sauce Arrabbiata Pasta', desc: 'Penne pasta in tangy spicy garlic tomato basil sauce', price: 89 },
          { name: 'White Sauce Alfredo Pasta', desc: 'Rich and creamy penne pasta tossed in garlic herb cheese sauce', price: 99 },
        ],
      },
      {
        category: 'Beverages & Coolers',
        image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500',
        masterCat: 'Beverages & Coolers',
        items: [
          { name: 'Chilled Cold Coffee', desc: 'Creamy blended iced coffee with chocolate drizzle', price: 59 },
          { name: 'Rich Chocolate Shake', desc: 'Thick milkshake blended with decadent chocolate syrup', price: 69 },
          { name: 'Fresh Mint Mojito', desc: 'Chilled sparkling cooler with fresh crushed mint and lime', price: 49 },
          { name: 'Blue Lagoon Mocktail', desc: 'Vibrant sweet and tangy citrus cooler', price: 49 },
        ],
      },
    ],
  },
];

async function main() {
  console.log('====================================================');
  console.log('--- Seeding 3 New Vendors for Sangod Hyperlocal ---');
  console.log('====================================================\n');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL in environment');
  }

  const config = parse(connectionString);
  const [{ address }] = await dns.lookup(config.host!, { all: true });

  const client = new Client({
    host: address,
    port: config.port ? Number(config.port) : 5432,
    user: config.user,
    password: config.password ?? undefined,
    database: config.database ?? undefined,
    ssl: {
      servername: config.host || undefined,
      rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 30_000,
  });

  await client.connect();
  const db = drizzle(client);

  for (const vSpec of VENDORS_DATA) {
    console.log(`\n----------------------------------------------------`);
    console.log(`Processing Vendor: ${vSpec.businessName}`);
    console.log(`Phone: ${vSpec.phone} | Owner: ${vSpec.ownerName}`);
    console.log(`Note: Email is omitted as explicitly instructed!`);
    console.log(`----------------------------------------------------`);

    const passwordHash = await bcrypt.hash(vSpec.passwordPlain, 10);

    // 1. User Setup
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.phone, vSpec.phone))
      .limit(1);

    if (!user) {
      [user] = await db
        .insert(users)
        .values({
          phone: vSpec.phone,
          email: null, // As instructed: DO NOT USE EMAIL
          name: `${vSpec.ownerName} (${vSpec.businessName})`,
          role: 'vendor',
          status: 'active',
          passwordHash,
          mustChangePassword: false,
        })
        .returning();
      console.log(`✔ User created: ID ${user.id}`);
    } else {
      [user] = await db
        .update(users)
        .set({
          name: `${vSpec.ownerName} (${vSpec.businessName})`,
          email: null, // Keep null
          role: 'vendor',
          status: 'active',
          passwordHash,
          mustChangePassword: false,
        })
        .where(eq(users.id, user.id))
        .returning();
      console.log(`✔ User updated: ID ${user.id}`);
    }

    // 2. Vendor Setup
    let [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, user.id))
      .limit(1);

    if (!vendor) {
      [vendor] = await db
        .insert(vendors)
        .values({
          userId: user.id,
          businessName: vSpec.businessName,
          ownerName: vSpec.ownerName,
          type: 'both',
          shopAddress: vSpec.shopAddress,
          pickupLat: vSpec.pickupLat,
          pickupLng: vSpec.pickupLng,
          radiusKm: 2000,
          kycStatus: 'verified',
          isOpen: true,
        })
        .returning();
      console.log(`✔ Vendor profile created: ID ${vendor.id}`);
    } else {
      [vendor] = await db
        .update(vendors)
        .set({
          businessName: vSpec.businessName,
          ownerName: vSpec.ownerName,
          type: 'both',
          shopAddress: vSpec.shopAddress,
          pickupLat: vSpec.pickupLat,
          pickupLng: vSpec.pickupLng,
          radiusKm: 2000,
          kycStatus: 'verified',
          isOpen: true,
        })
        .where(eq(vendors.id, vendor.id))
        .returning();
      console.log(`✔ Vendor profile updated: ID ${vendor.id}`);
    }

    // 3. Restaurant Setup
    let [restaurant] = await db
      .select()
      .from(restaurants)
      .where(eq(restaurants.vendorId, vendor.id))
      .limit(1);

    if (!restaurant) {
      [restaurant] = await db
        .insert(restaurants)
        .values({
          vendorId: vendor.id,
          name: vSpec.businessName,
          cuisineTags: vSpec.cuisineTags,
          imageUrl: vSpec.restaurantImage,
          ratingAvg: 4.8,
          isOpen: true,
        })
        .returning();
      console.log(`✔ Restaurant created: ID ${restaurant.id}`);
    } else {
      [restaurant] = await db
        .update(restaurants)
        .set({
          name: vSpec.businessName,
          cuisineTags: vSpec.cuisineTags,
          imageUrl: vSpec.restaurantImage,
          ratingAvg: 4.8,
          isOpen: true,
        })
        .where(eq(restaurants.id, restaurant.id))
        .returning();
      console.log(`✔ Restaurant updated: ID ${restaurant.id}`);
    }

    // 4. Clean old menu items for clean refresh
    const existingMenuCats = await db
      .select()
      .from(menuCategories)
      .where(eq(menuCategories.restaurantId, restaurant.id));

    const existingCatIds = existingMenuCats.map((c) => c.id);
    if (existingCatIds.length > 0) {
      const existingItems = await db
        .select({ id: menuItems.id })
        .from(menuItems)
        .where(inArray(menuItems.menuCategoryId, existingCatIds));

      const existingItemIds = existingItems.map((i) => i.id);
      if (existingItemIds.length > 0) {
        await db.delete(menuItemVariants).where(inArray(menuItemVariants.menuItemId, existingItemIds));
        await db.delete(menuItemAddons).where(inArray(menuItemAddons.menuItemId, existingItemIds));
        await db.delete(menuItems).where(inArray(menuItems.id, existingItemIds));
      }
      await db.delete(menuCategories).where(inArray(menuCategories.id, existingCatIds));
      console.log(`✔ Cleaned previous menu data for fresh seed`);
    }

    // 5. Ensure Master Categories in 'categories' table
    const masterCatNames = Array.from(new Set(vSpec.categories.map((c) => c.masterCat)));
    const existingMasterCats = await db
      .select()
      .from(categories)
      .where(inArray(categories.name, masterCatNames));

    const masterCatMap = new Map<string, string>();
    for (const mc of existingMasterCats) {
      masterCatMap.set(mc.name, mc.id);
    }
    const toInsertMasterCats = masterCatNames
      .filter((n) => !masterCatMap.has(n))
      .map((name) => {
        const sample = vSpec.categories.find((c) => c.masterCat === name);
        return {
          name,
          imageUrl: sample?.image ?? 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500',
        };
      });

    if (toInsertMasterCats.length > 0) {
      const inserted = await db.insert(categories).values(toInsertMasterCats).returning();
      for (const m of inserted) {
        masterCatMap.set(m.name, m.id);
      }
    }

    // 6. Insert Menu Categories
    const catRows = vSpec.categories.map((c, idx) => ({
      restaurantId: restaurant.id,
      name: c.category,
      sortOrder: idx + 1,
    }));
    const insertedCats = await db.insert(menuCategories).values(catRows).returning();
    const menuCatMap = new Map<string, string>();
    for (const c of insertedCats) {
      menuCatMap.set(c.name, c.id);
    }
    console.log(`✔ Inserted ${insertedCats.length} menu categories`);

    // 7. Prepare Menu Items & Metadata
    const menuItemsBatch: any[] = [];
    const metaList: any[] = [];

    for (const catSpec of vSpec.categories) {
      const catId = menuCatMap.get(catSpec.category)!;
      const masterCategoryId = masterCatMap.get(catSpec.masterCat)!;

      for (const item of catSpec.items) {
        const isHalfFull = item.half !== undefined && item.full !== undefined;
        const basePrice = isHalfFull ? item.half! : item.price;
        const mrpPrice = isHalfFull ? item.full! : item.price;

        menuItemsBatch.push({
          menuCategoryId: catId,
          name: item.name,
          description: item.desc,
          price: basePrice,
          imageUrl: catSpec.image,
          isVeg: item.isVeg ?? true,
          isAvailable: true,
        });

        metaList.push({
          name: item.name,
          desc: item.desc,
          image: catSpec.image,
          masterCategoryId,
          basePrice,
          mrpPrice,
          isHalfFull,
          half: item.half,
          full: item.full,
          unit: item.unit ?? (isHalfFull ? '500g / 1kg' : '1 portion'),
          size: isHalfFull ? 'Half / Full' : 'Standard',
          hasStandardAddons: !!item.hasStandardAddons,
        });
      }
    }

    // Batch insert menu items
    const insertedMenuItems: any[] = [];
    for (let i = 0; i < menuItemsBatch.length; i += 50) {
      const chunk = menuItemsBatch.slice(i, i + 50);
      const res = await db.insert(menuItems).values(chunk).returning();
      insertedMenuItems.push(...res);
    }
    console.log(`✔ Inserted ${insertedMenuItems.length} menu items`);

    // 8. Variants and Addons
    const variantsBatch: any[] = [];
    const addonsBatch: any[] = [];

    for (let i = 0; i < insertedMenuItems.length; i++) {
      const mItem = insertedMenuItems[i];
      const meta = metaList[i];

      if (meta.isHalfFull) {
        variantsBatch.push(
          { menuItemId: mItem.id, name: 'Half (500g)', priceDelta: 0, isDefault: true },
          { menuItemId: mItem.id, name: 'Full (1kg)', priceDelta: meta.full! - meta.half!, isDefault: false },
        );
      }

      if (meta.hasStandardAddons && vSpec.standardAddons && vSpec.standardAddons.length > 0) {
        for (const sa of vSpec.standardAddons) {
          addonsBatch.push({
            menuItemId: mItem.id,
            name: sa.name,
            price: sa.price,
            isRequired: false,
          });
        }
      }
    }

    if (variantsBatch.length > 0) {
      for (let i = 0; i < variantsBatch.length; i += 50) {
        await db.insert(menuItemVariants).values(variantsBatch.slice(i, i + 50));
      }
      console.log(`✔ Inserted ${variantsBatch.length} variants`);
    }

    if (addonsBatch.length > 0) {
      for (let i = 0; i < addonsBatch.length; i += 50) {
        await db.insert(menuItemAddons).values(addonsBatch.slice(i, i + 50));
      }
      console.log(`✔ Inserted ${addonsBatch.length} addons`);
    }

    // Restaurant dishes belong in menu_items, not master grocery products.
    console.log(`Skipping master grocery products insertion for ${vSpec.businessName}.`);
  }

  console.log(`\n====================================================`);
  console.log(`✔ ALL 3 VENDOR ACCOUNTS & MENUS CREATED SUCCESSFULLY!`);
  console.log(`====================================================\n`);

  await client.end();
}

main().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});

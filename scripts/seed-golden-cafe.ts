import 'dotenv/config';
import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, inArray } from 'drizzle-orm';
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
  categories,
  products,
  vendorProducts,
} from '../drizzle/schema';

interface MenuItemSpec {
  name: string;
  desc: string;
  price?: number;
  half?: number;
  full?: number;
  pcs6?: number;
  pcs12?: number;
  unit?: string;
}

interface MenuCategorySpec {
  category: string;
  description: string;
  image: string;
  masterCat: string;
  items: MenuItemSpec[];
}

const GOLDEN_CAFE_DATA: MenuCategorySpec[] = [
  {
    category: 'Paneer & Kaju Special',
    description: 'Shahi Swad Paneer Ke Sath - Rich & creamy cottage cheese & cashew delicacies',
    image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500',
    masterCat: 'Main Course - Paneer & Curries',
    items: [
      { name: 'Matar Paneer', desc: 'Cottage cheese cubes & green peas in spiced gravy (मटर पनीर)', half: 80, full: 150 },
      { name: 'Shahi Paneer', desc: 'Royal Mughlai paneer in rich creamy nut gravy (शाही पनीर)', half: 90, full: 170 },
      { name: 'Kadai Paneer', desc: 'Paneer tossed with bell peppers & fresh spices (कड़ाही पनीर)', half: 80, full: 150 },
      { name: 'Butter Paneer Masala', desc: 'Tender paneer in rich creamy tomato butter sauce (बटर पनीर मसाला)', half: 90, full: 170 },
      { name: 'Palak Paneer', desc: 'Paneer cubes in vibrant spiced spinach puree (पालक पनीर)', half: 80, full: 150 },
      { name: 'Paneer Masala', desc: 'Paneer in traditional aromatic onion tomato masala (पनीर मसाला)', half: 90, full: 170 },
      { name: 'Malai Paneer', desc: 'Paneer cooked in rich creamy white malai sauce (मलाई पनीर)', half: 90, full: 160 },
      { name: 'Chola Paneer', desc: 'Chickpeas & paneer simmered in robust gravy (छोला पनीर)', half: 80, full: 150 },
      { name: 'Gobhi Paneer', desc: 'Cauliflower & paneer stir-cooked with spices (गोभी पनीर)', half: 80, full: 150 },
      { name: 'Paneer Pasanda', desc: 'Stuffed paneer sandwiches in luscious gravy (पनीर पसंदा)', half: 100, full: 180 },
      { name: 'Paneer Bhurji', desc: 'Scrambled paneer sautéed with onions & chilies (पनीर भुर्जी)', half: 120, full: 220 },
      { name: 'Kaju Paneer', desc: 'Cashews & paneer in royal aromatic gravy (काजू पनीर)', half: 110, full: 200 },
      { name: 'Kaju Masala', desc: 'Roasted cashew nuts in spiced onion tomato curry (काजू मसाला)', half: 110, full: 200 },
      { name: 'Kaju Kari White', desc: 'Cashews simmered in silky white cashew cream (काजू करी व्हाइट)', half: 100, full: 190 },
      { name: 'Kaju Kari Red', desc: 'Cashews cooked in tangy rich red gravy (काजू करी रेड)', half: 100, full: 190 },
      { name: 'Paneer Shimla Mirch', desc: 'Paneer with crispy capsicum in savory sauce (पनीर शिमला मिर्च)', half: 80, full: 150 },
      { name: 'Paneer Korma', desc: 'Paneer in slow-cooked mild nutty yogurt gravy (पनीर कोरमा)', half: 100, full: 180 },
      { name: 'Paneer Lababdar', desc: 'Grated & cubed paneer in tangy rich gravy (पनीर लबाबदार)', half: 100, full: 180 },
      { name: 'Kaju Butter Fry', desc: 'Golden fried cashew nuts in spiced butter (काजू बटर फ्राई)', half: 100, full: 180 },
      { name: 'Kaju Matar', desc: 'Cashews & tender green peas in mild curry (काजू मटर)', half: 110, full: 190 },
      { name: 'Mix Vegetable', desc: 'Assorted fresh seasonal veggies in spiced curry (मिक्स वेज)', half: 80, full: 150 },
      { name: 'Matar Masala', desc: 'Sweet green peas in aromatic spiced masala (मटर मसाला)', half: 80, full: 150 },
      { name: 'Malai Kofta', desc: 'Melt-in-mouth paneer dumplings in rich cream sauce (मलाई कोफ्ता)', half: 90, full: 170 },
      { name: 'Golden Special Paneer', desc: 'Chef signature rich paneer preparation (गोल्डन स्पेशल पनीर)', half: 120, full: 200 },
      { name: 'Chola Masala', desc: 'Authentic spiced chickpea Punjabi style curry (छोला मसाला)', half: 80, full: 150 },
      { name: 'Paneer Angara', desc: 'Smoky spicy cottage cheese in fiery red gravy (पनीर अंगारा)', half: 90, full: 170 },
      { name: 'Paneer Toofani', desc: 'Spicy zingy paneer cooked with robust herbs (पनीर तूफानी)', half: 90, full: 170 },
      { name: 'Handi Paneer', desc: 'Paneer slow-cooked in traditional earthenware pot (हांडी पनीर)', half: 90, full: 170 },
      { name: 'Paneer Takatak', desc: 'Tawa sizzled spicy tangy paneer specialty (पनीर टकाटक)', half: 100, full: 180 },
    ],
  },
  {
    category: 'Dal Special',
    description: 'Slow cooked lentils tempered with pure ghee & spices',
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500',
    masterCat: 'Dal & Lentils',
    items: [
      { name: 'Dal Fry', desc: 'Yellow lentils tempered with cumin, garlic & tomatoes (दाल फ्राई)', half: 60, full: 110 },
      { name: 'Dal Tadka', desc: 'Lentils finished with double tempering of desi ghee (दाल तड़का)', half: 70, full: 130 },
      { name: 'Dal Makhani', desc: 'Black lentils & kidney beans slow cooked with butter & cream (दाल मखनी)', half: 80, full: 150 },
      { name: 'Dal Fry Makkhan', desc: 'Classic dal fry topped with generous dollop of butter (दाल फ्राई मक्खन)', half: 80, full: 150 },
      { name: 'Dal Paneer Masala', desc: 'Unique blend of yellow lentils and paneer cubes (दाल पनीर मसाला)', half: 90, full: 170 },
      { name: 'Dal Butter', desc: 'Rich creamy lentils infused with rich butter (दाल बटर)', half: 90, full: 160 },
      { name: 'Punjabi Dal Makhani', desc: 'Authentic Dhaba style slow-simmered dal makhani (पंजाबी दाल मखनी)', half: 80, full: 150 },
    ],
  },
  {
    category: 'Besan Special',
    description: 'Traditional Rajasthani & Western Indian besan curries',
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500',
    masterCat: 'Rajasthani & Traditional Sabzi',
    items: [
      { name: 'Besan Gatta', desc: 'Rajasthani gram flour dumplings in spiced yogurt curry (बेसन गट्टा)', half: 70, full: 130 },
      { name: 'Sev Bhaji Special', desc: 'Spicy Kathiyawadi style sev simmered in tomato onion gravy (सेव भाजी)', half: 70, full: 130 },
      { name: 'Sev Tamatar', desc: 'Crispy sev in sweet & tangy tomato gravy (सेव टमाटर)', half: 60, full: 110 },
      { name: 'Kadhi Pakoda', desc: 'Gram flour pakoras in tempered sour yogurt kadhi (कढ़ी पकोड़ा)', half: 80, full: 130 },
      { name: 'Pakodi Masala', desc: 'Crispy gram fritters in aromatic spiced gravy (पकोड़ी मसाला)', half: 70, full: 120 },
      { name: 'Gujarati Kadhi', desc: 'Sweet & tangy traditional buttermilk kadhi (गुजराती कढ़ी)', half: 50, full: 90 },
      { name: 'Gatta Masala', desc: 'Spiced besan gattas in robust onion garlic gravy (गट्टा मसाला)', half: 80, full: 150 },
    ],
  },
  {
    category: 'Seasonal Sabzi',
    description: 'Fresh seasonal market vegetables cooked to perfection',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500',
    masterCat: 'Seasonal Sabzi',
    items: [
      { name: 'Bharwa Bengan', desc: 'Baby eggplants stuffed with peanut & spice masala (भरवा बैंगन)', half: 80, full: 140 },
      { name: 'Bhindi Fry', desc: 'Crispy spiced okra shallow fried with dry herbs (भिंडी फ्राई)', half: 70, full: 130 },
      { name: 'Bhindi Masala', desc: 'Tender okra cooked with sliced onions & tangy tomatoes (भिंडी मसाला)', half: 80, full: 150 },
      { name: 'Aalu Bhindi', desc: 'Homestyle potato and okra stir fry (आलू भिंडी)', half: 70, full: 120 },
      { name: 'Bhindi Pyaz', desc: 'Okra tossed with caramelized crisp onions (भिंडी प्याज)', half: 70, full: 120 },
      { name: 'Gobhi Masala', desc: 'Cauliflower florets cooked in spicy thick masala (गोभी मसाला)', half: 70, full: 110 },
      { name: 'Bengan Masala', desc: 'Eggplant chunks cooked in rich savory sauce (बैंगन मसाला)', half: 70, full: 110 },
    ],
  },
  {
    category: 'Aalu Special',
    description: 'Aalu Ka Jalwa - Versatile potato dishes cooked in homestyle spices',
    image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500',
    masterCat: 'Aalu Special Dishes',
    items: [
      { name: 'Aalu Matar', desc: 'Potatoes & sweet peas in spiced tomato gravy (आलू मटर)', half: 60, full: 110 },
      { name: 'Aalu Palak', desc: 'Potatoes in fresh nutritious spinach gravy (आलू पालक)', half: 60, full: 110 },
      { name: 'Aalu Tamatar', desc: 'Tender potatoes in tangy tomato broth (आलू टमाटर)', half: 60, full: 100 },
      { name: 'Aalu Chole', desc: 'Classic combination of spiced potatoes and chickpeas (आलू छोले)', half: 70, full: 120 },
      { name: 'Zeera Aalu', desc: 'Diced potatoes tempered with roasted cumin seeds (जीरा आलू)', half: 70, full: 130 },
      { name: 'Dum Aalu', desc: 'Baby potatoes simmered in rich spicy Kashmiri style gravy (दम आलू)', half: 80, full: 150 },
      { name: 'Aalu Chilli', desc: 'Spicy chili-tossed crispy potatoes (आलू चिली)', half: 70, full: 120 },
      { name: 'Aalu Fry', desc: 'Golden pan-fried spiced potatoes (आलू फ्राई)', half: 60, full: 110 },
      { name: 'Aalu Gobhi', desc: 'Traditional potato & cauliflower preparation (आलू गोभी)', half: 70, full: 130 },
      { name: 'Aalu Shimla Mirch', desc: 'Potatoes and green bell peppers stir fry (आलू शिमला मिर्च)', half: 70, full: 120 },
      { name: 'Aalu Masala', desc: 'Potatoes sautéed with aromatic Indian spices (आलू मसाला)', half: 60, full: 110 },
      { name: 'Aalu Pyaz', desc: 'Country style potatoes sautéed with chopped onions (आलू प्याज)', half: 60, full: 110 },
      { name: 'Aalu Gobhi Matar', desc: 'Potatoes, cauliflower and green peas trio (आलू गोभी मटर)', half: 70, full: 120 },
      { name: 'Aalu Bengan', desc: 'Potatoes and eggplant cooked in rustic curry (आलू बैंगन)', half: 60, full: 110 },
    ],
  },
  {
    category: 'Rice & Pulav',
    description: 'Fragrant basmati rice specialties and spiced pulaos',
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500',
    masterCat: 'Rice & Pulav',
    items: [
      { name: 'Steam Rice', desc: 'Fluffy steamed long-grain basmati rice (स्टीम राइस)', half: 50, full: 90 },
      { name: 'Zeera Rice', desc: 'Basmati rice tempered with aromatic cumin & ghee (जीरा राइस)', half: 60, full: 110 },
      { name: 'Namkin Chawal', desc: 'Savory spiced salted rice (नमकीन चावल)', half: 70, full: 120 },
      { name: 'Matar Pulao', desc: 'Basmati rice cooked with fresh green peas (मटर पुलाव)', half: 70, full: 130 },
      { name: 'Kashmiri Pulao', desc: 'Fragrant pulao garnished with dry fruits & saffron (कश्मीरी पुलाव)', half: 80, full: 150 },
      { name: 'Kaju Pulao', desc: 'Rich basmati pulao enriched with roasted cashews (काजू पुलाव)', half: 80, full: 150 },
      { name: 'Paneer Pulao', desc: 'Fluffy rice tossed with soft paneer cubes (पनीर पुलाव)', half: 80, full: 150 },
      { name: 'Veg Pulao', desc: 'Basmati rice cooked with garden fresh vegetables (वेज पुलाव)', half: 70, full: 130 },
      { name: 'Meetha Chawal', desc: 'Sweet saffron flavored aromatic dessert rice (मीठा चावल)', half: 60, full: 110 },
      { name: 'Fried Rice', desc: 'Indo-Chinese wok-tossed vegetable fried rice (फ्राईड राइस)', half: 80, full: 150 },
      { name: 'Schezwan Rice', desc: 'Zesty rice tossed in fiery Schezwan chili sauce (सेजवान राइस)', half: 80, full: 150 },
    ],
  },
  {
    category: 'Dahi & Raita',
    description: 'Chilled curd, refreshing seasoned raitas and spiced buttermilk',
    image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500',
    masterCat: 'Dahi, Raita & Accompaniments',
    items: [
      { name: 'Dahi Fry', desc: 'Curd tempered with mustard, cumin and curry spices (दही फ्राई)', half: 70, full: 110 },
      { name: 'Dahi Sada', desc: 'Fresh plain thick creamy curd (दही सादा)', half: 30, full: 50 },
      { name: 'Boondi Raita', desc: 'Crispy chickpea pearls in seasoned yogurt (बूंदी रायता)', half: 40, full: 70 },
      { name: 'Veg Raita', desc: 'Cool yogurt with diced cucumber, onions & tomatoes (वेज रायता)', half: 50, full: 80 },
      { name: 'Masala Chhach', desc: 'Traditional spiced churning buttermilk with roasted cumin (मसाला छाछ)', price: 20 },
    ],
  },
  {
    category: 'Papad & Sides',
    description: 'Crispy roasted and fried papads with spicy toppings',
    image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=500',
    masterCat: 'Dahi, Raita & Accompaniments',
    items: [
      { name: 'Fry Masala Papad', desc: 'Deep fried crispy papad loaded with onion, tomato & chaat masala (फ्राई मसाला पापड़)', price: 50 },
      { name: 'Papad Sada', desc: 'Roasted plain crisp lentil papad (पापड़ सादा)', price: 20 },
      { name: 'Papad Fry', desc: 'Golden deep-fried lentil papad (पापड़ फ्राई)', price: 25 },
      { name: 'Masala Papad', desc: 'Roasted papad topped with spicy onion-tomato salsa (मसाला पापड़)', price: 30 },
    ],
  },
  {
    category: 'Thali & Special Combos',
    description: 'Complete wholesome Indian meals and thalis',
    image: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=500',
    masterCat: 'Thali & Meal Combos',
    items: [
      { name: 'Regular Thali', desc: '6 Chapati, Dal Fry, Chhach, Salad (रेगुलर थाली)', price: 120 },
      { name: 'Rajasthani Thali (Sunday Special)', desc: 'Dal, Baati, Kadhi, Rice, Chutney, Achar, Salad, Chhach (राजस्थानी थाली)', price: 150 },
      { name: 'Hamari Thali', desc: '6 Chapati, Matar Paneer, Dal Fry, Raita, Salad (हमारी थाली)', price: 150 },
      { name: 'Golden Special Thali', desc: '2 Golden Laccha Paratha, Dal Tadka, Shahi Paneer, Raita, Papad, Salad, Sweet (गोल्डन स्पेशल थाली)', price: 180 },
      { name: 'Chole Bhature', desc: '2 Fluffy deep-fried bhaturas served with spicy chole & pickle (छोले भटूरे)', price: 80 },
    ],
  },
  {
    category: 'Tawa Breads',
    description: 'Freshly rolled tawa rotis and stuffed parathas',
    image: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=500',
    masterCat: 'Indian Breads & Parathas',
    items: [
      { name: 'Chapati Sada (Tawa)', desc: 'Whole wheat homestyle flatbread (चपाती सादा)', price: 10 },
      { name: 'Chapati Ghee (Tawa)', desc: 'Hot chapati brushed with pure desi ghee (चपाती घी)', price: 12 },
      { name: 'Chapati Butter (Tawa)', desc: 'Whole wheat chapati coated with fresh butter (चपाती बटर)', price: 12 },
      { name: 'Golden Laccha Paratha (Tawa)', desc: 'Crispy layered whole wheat paratha (गोल्डन लच्छा पराठा)', price: 35 },
      { name: 'Paratha Gol', desc: 'Round homestyle shallow fried paratha (पराठा गोल)', price: 15 },
      { name: 'Paratha Tikona', desc: 'Triangle flaky layered tawa paratha (पराठा तिकोना)', price: 20 },
      { name: 'Pyaz Paratha', desc: 'Stuffed with seasoned chopped onions (प्याज पराठा)', price: 30 },
      { name: 'Aalu Paratha', desc: 'Stuffed with spiced mashed potatoes (आलू पराठा)', price: 35 },
      { name: 'Aalu Pyaz Paratha', desc: 'Stuffed with spiced potato and onion mix (आलू प्याज पराठा)', price: 40 },
      { name: 'Aalu Gobhi Paratha', desc: 'Stuffed with grated cauliflower and potatoes (आलू गोभी पराठा)', price: 30 },
      { name: 'Paneer Paratha', desc: 'Stuffed with grated spiced paneer and herbs (पनीर पराठा)', price: 50 },
      { name: 'Methi Paratha', desc: 'Fenugreek leaf infused spiced flatbread (मेथी पराठा)', price: 40 },
      { name: 'Missi Roti', desc: 'Spiced gram flour & wheat flour roasted flatbread (मिस्सी रोटी)', price: 20 },
    ],
  },
  {
    category: 'Tandoori Breads',
    description: 'Clay-oven baked rotis, naans and tandoori parathas',
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500',
    masterCat: 'Indian Breads & Parathas',
    items: [
      { name: 'Tandoori Roti Sada', desc: 'Crispy clay-oven baked plain roti (तंदूरी रोटी सादा)', price: 10 },
      { name: 'Tandoori Roti Ghee', desc: 'Tandoori roti glazed with pure ghee (तंदूरी रोटी घी)', price: 12 },
      { name: 'Tandoori Roti Butter', desc: 'Tandoori roti topped with melted butter (तंदूरी रोटी बटर)', price: 12 },
      { name: 'Tandoori Laccha Paratha', desc: 'Crisp multi-layered tandoor baked paratha (तंदूरी लच्छा पराठा)', price: 35 },
      { name: 'Butter Naan', desc: 'Soft leavened tandoor bread brushed with butter (बटर नान)', price: 30 },
    ],
  },
  {
    category: 'Desserts & Sweets',
    description: 'Traditional Indian sweet treats and sweet lassi',
    image: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=500',
    masterCat: 'Desserts & Sweets',
    items: [
      { name: 'Rasgulla', desc: 'Spongy cottage cheese ball soaked in light sugar syrup (1 pc) (रसगुल्ला)', price: 20 },
      { name: 'Gulab Jamun', desc: 'Warm fried milk solids dumpling dipped in cardamom syrup (1 pc) (गुलाब जामुन)', price: 20 },
      { name: 'Sweet Lassi', desc: 'Creamy churned yogurt sweet beverage with malai (लस्सी)', price: 50 },
    ],
  },
  {
    category: 'Momos',
    description: 'Steamed and fried dumplings served with spicy chili garlic chutney',
    image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=500',
    masterCat: 'Fast Food & Chinese',
    items: [
      { name: 'Steam Momos', desc: 'Steamed vegetable dumplings filled with minced veggies (स्टीम मोमोज)', pcs6: 50, pcs12: 100 },
      { name: 'Fried Momos', desc: 'Crispy deep-fried vegetable momos (फ्राइड मोमोज)', pcs6: 70, pcs12: 140 },
      { name: 'Paneer Momos', desc: 'Steamed dumplings stuffed with seasoned paneer (पनीर मोमोज)', pcs6: 80, pcs12: 160 },
      { name: 'Cheese Momos', desc: 'Steamed dumplings packed with melted cheese (चीज मोमोज)', pcs6: 80, pcs12: 160 },
    ],
  },
  {
    category: 'Rolls',
    description: 'Crispy wrapped frankies filled with flavorful fillings',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500',
    masterCat: 'Fast Food & Chinese',
    items: [
      { name: 'Veg Roll', desc: 'Spiced vegetable patty wrapped in flaky paratha (वेज रोल)', price: 90 },
      { name: 'Spring Roll', desc: 'Crispy fried rolls filled with seasoned noodles & veggies (स्प्रिंग रोल)', price: 90 },
      { name: 'Paneer Roll', desc: 'Sautéed spiced paneer wrapped with crunchy onions (पनीर रोल)', price: 110 },
      { name: 'Cheese Roll', desc: 'Gooey melted cheese and vegetable filling wrap (चीज रोल)', price: 110 },
    ],
  },
  {
    category: 'Hot Beverages',
    description: 'Freshly brewed masala teas, coffees and hot chocolate',
    image: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=500',
    masterCat: 'Beverages & Cafe',
    items: [
      { name: 'Hot Coffee', desc: 'Frothy rich steamed milk coffee (हॉट कॉफी)', price: 25 },
      { name: 'Hot Chocolate', desc: 'Rich creamy Belgian style hot cocoa (हॉट चॉकलेट)', price: 60 },
      { name: 'Chai Masala', desc: 'Aromatic milk tea brewed with whole spices (मसाला चाय)', price: 20 },
      { name: 'Chai Elaichi', desc: 'Fragrant cardamom infused hot milk tea (इलायची चाय)', price: 20 },
      { name: 'Chai Adrak', desc: 'Zesty crushed ginger boiled milk tea (अदरक चाय)', price: 20 },
    ],
  },
  {
    category: 'Shakes & Cold Coffee',
    description: 'Chilled thick milkshakes and blended ice coffees',
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500',
    masterCat: 'Beverages & Cafe',
    items: [
      { name: 'Chocolate Shake', desc: 'Creamy chocolate milkshake topped with chocolate syrup (चॉकलेट शेक)', price: 80 },
      { name: 'Cold Coffee', desc: 'Classic thick iced coffee topped with chocolate dusting (कोल्ड कॉफी)', price: 90 },
      { name: 'Kitkat Shake', desc: 'Thick milkshake blended with crushed KitKat bars (किटकेट शेक)', price: 110 },
      { name: 'Oreo Shake', desc: 'Decadent shake blended with Oreo cookies & cream (ओरियो शेक)', price: 110 },
    ],
  },
  {
    category: 'Burgers',
    description: 'Grilled buns with crispy patties, sauces and fresh greens',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500',
    masterCat: 'Burgers & Sandwiches',
    items: [
      { name: 'Aaloo Tikki Burger', desc: 'Crispy spiced potato patty with house sauce & onions (आलू टिक्की बर्गर)', price: 50 },
      { name: 'Veg Cheese Burger', desc: 'Vegetable patty topped with melted cheese slice (वेज चीज बर्गर)', price: 60 },
      { name: 'Paneer Slice Burger', desc: 'Crispy paneer block patty with special mayo (पनीर स्लाइस बर्गर)', price: 80 },
      { name: 'Spicy Burger', desc: 'Fiery chili marinated patty with hot sauce (स्पाइसी बर्गर)', price: 70 },
      { name: 'Double Tikki Burger', desc: 'Loaded with two crispy patties and double sauce (डबल टिक्की बर्गर)', price: 90 },
      { name: 'Cheese Slice Burger', desc: 'Topped with extra creamy cheese slice (चीज स्लाइस बर्गर)', price: 80 },
    ],
  },
  {
    category: 'Starters & Appetizers',
    description: 'Sizzling paneer appetizers and crispy dry starters',
    image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=500',
    masterCat: 'Starters & Appetizers',
    items: [
      { name: 'Chilli Paneer', desc: 'Crispy paneer cubes tossed with soy, garlic and green chilies (चिली पनीर)', half: 120, full: 220 },
      { name: 'Paneer Tikka', desc: 'Yogurt and tandoori spice marinated charred paneer (पनीर टिक्का)', half: 120, full: 220 },
      { name: 'Paneer Kiss Me', desc: 'Golden fried stuffed paneer bites with cheese dip (पनीर किस मी)', half: 100, full: 190 },
      { name: 'Paneer Roasted', desc: 'Pan-roasted seasoned cottage cheese slices (पनीर रोस्टेड)', half: 80, full: 150 },
    ],
  },
  {
    category: 'Pizzas',
    description: 'Stone-baked Italian crust pizzas with melted mozzarella & toppings',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500',
    masterCat: 'Pizzas & Italian',
    items: [
      { name: 'Margherita Pizza', desc: 'Classic tomato herb sauce with 100% mozzarella cheese (मार्गरिटा पिज़्ज़ा)', price: 120 },
      { name: 'Veg Cheese Pizza', desc: 'Topped with bell peppers, onions and melted cheese (वेज चीज पिज़्ज़ा)', price: 130 },
      { name: 'Masala Veg Pizza', desc: 'Spiced Indian vegetables with tangy pizza sauce (मसाला वेज पिज़्ज़ा)', price: 140 },
      { name: 'Onion Capsicum Pizza', desc: 'Crunchy onions and green capsicum with mozzarella (अनियन कैप्सिकम पिज़्ज़ा)', price: 140 },
      { name: 'Chilli Paneer Pizza', desc: 'Fusion pizza loaded with spicy chilli paneer chunks (चिली पनीर पिज़्ज़ा)', price: 200 },
      { name: 'French Fry Pizza', desc: 'Unique pizza topped with crispy seasoned french fries (फ्रेंच फ्राई पिज़्ज़ा)', price: 170 },
      { name: 'Sweet Corn Pizza', desc: 'Juicy golden sweet corn with double mozzarella (स्वीट कॉर्न पिज़्ज़ा)', price: 170 },
      { name: 'Paneer Pizza', desc: 'Generously topped with marinated spiced paneer cubes (पनीर पिज़्ज़ा)', price: 150 },
      { name: 'Double Cheese Pizza', desc: 'Double layer of molten mozzarella and cheddar (डबल चीज पिज़्ज़ा)', price: 250 },
    ],
  },
  {
    category: 'French Fries & Potato',
    description: 'Crispy golden potato fries and glazed chili potatoes',
    image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=500',
    masterCat: 'Fast Food & Chinese',
    items: [
      { name: 'Salty French Fries', desc: 'Classic crispy golden fries seasoned with sea salt (साल्टी फ्रेंच फ्राइज)', price: 70 },
      { name: 'Masala French Fries', desc: 'Fries dusted with spicy tangy chaat masala (मसाला फ्रेंच फ्राइज)', price: 80 },
      { name: 'Peri-Peri French Fries', desc: 'Fries tossed in fiery African peri-peri seasoning (पेरी पेरी फ्रेंच फ्राइज)', price: 100 },
      { name: 'Butter French Fries', desc: 'Golden fries glazed with rich melted butter (बटर फ्रेंच फ्राइज)', price: 100 },
      { name: 'Chilli Potato', desc: 'Crispy potato fingers tossed in spicy chili sauce (चिली पोटैटो)', price: 90 },
      { name: 'Honey Chilli Potato', desc: 'Crisp potatoes glazed in sweet honey and spicy chili sesame sauce (हनी चिली पोटैटो)', price: 99 },
    ],
  },
  {
    category: 'Sandwiches & Garlic Bread',
    description: 'Toasted sandwiches and buttery garlic bread treats',
    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500',
    masterCat: 'Burgers & Sandwiches',
    items: [
      { name: 'Veg Sandwich', desc: 'Fresh cucumber, tomato and mint chutney sandwich (वेज सैंडविच)', price: 50 },
      { name: 'Veg Cheese Sandwich', desc: 'Toasted sandwich with crunchy veggies & cheese (वेज चीज सैंडविच)', price: 60 },
      { name: 'Paneer Cheese Sandwich', desc: 'Loaded with spiced cottage cheese and mozzarella (पनीर चीज सैंडविच)', price: 90 },
      { name: 'Masala Cheese Sandwich', desc: 'Spicy potato masala and melted cheese filling (मसाला चीज सैंडविच)', price: 80 },
      { name: 'Triple Decker Sandwich', desc: 'Three-layered jumbo sandwich with double stuffing (ट्रिपल डेकर सैंडविच)', price: 150 },
      { name: 'House Full Sandwich', desc: 'Chef special loaded signature grilled sandwich (हाउस फुल सैंडविच)', price: 140 },
      { name: 'Cheese Garlic Bread', desc: 'Crispy toasted baguette brushed with garlic butter & cheese (चीज गार्लिक ब्रेड)', price: 90 },
      { name: 'Masala Garlic Bread', desc: 'Garlic bread seasoned with herbs, onions & chilies (मसाला गार्लिक ब्रेड)', price: 90 },
    ],
  },
  {
    category: 'Maggi',
    description: 'Everyones favorite 2-minute noodles prepared with custom toppings',
    image: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500',
    masterCat: 'Fast Food & Chinese',
    items: [
      { name: 'Plain Maggi', desc: 'Classic savory Maggi noodles (प्लेन मैगी)', price: 50 },
      { name: 'Masala Maggi', desc: 'Maggi tossed with onions, tomatoes & extra spices (मसाला मैगी)', price: 60 },
      { name: 'Paneer Maggi', desc: 'Maggi noodles with sautéed paneer cubes (पनीर मैगी)', price: 80 },
      { name: 'Paneer Cheese Maggi', desc: 'Loaded with fresh paneer and melted mozzarella (पनीर चीज मैगी)', price: 100 },
    ],
  },
  {
    category: 'Chowmein & Noodles',
    description: 'Wok-tossed noodles with crunchy vegetables and soy',
    image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500',
    masterCat: 'Fast Food & Chinese',
    items: [
      { name: 'Plain Chowmein', desc: 'Wok tossed noodles with light soy and garlic (प्लेन चाऊमीन)', price: 50 },
      { name: 'Veg Chowmein', desc: 'Street style stir fried noodles with shredded veggies (वेज चाऊमीन)', price: 50 },
      { name: 'Paneer Chowmein', desc: 'Stir-fried noodles enriched with spiced paneer chunks (पनीर चाऊमीन)', price: 70 },
      { name: 'Cheese Chowmein', desc: 'Hot wok noodles topped with melted cheese (चीज चाऊमीन)', price: 80 },
      { name: 'Hakka Noodles', desc: 'Indo-Chinese style noodles tossed with cabbage & bell peppers (हक्का नूडल्स)', price: 60 },
    ],
  },
  {
    category: 'Manchurian',
    description: 'Fried vegetable balls tossed in savory ginger garlic Chinese sauce',
    image: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=500',
    masterCat: 'Fast Food & Chinese',
    items: [
      { name: 'Manchurian Dry', desc: 'Crispy vegetable balls tossed in spicy dry sauce (मंचूरियन ड्राई)', price: 130 },
      { name: 'Manchurian Gravy', desc: 'Veg dumplings simmered in rich dark garlic gravy (मंचूरियन ग्रेवी)', price: 140 },
      { name: 'Manchurian Potato', desc: 'Crispy potato bites coated in savory manchurian glaze (मंचूरियन पोटैटो)', price: 140 },
      { name: 'Paneer Manchurian', desc: 'Golden paneer cubes tossed in tangy manchurian sauce (पनीर मंचूरियन)', price: 180 },
    ],
  },
  {
    category: 'Pasta',
    description: 'Italian penne pasta tossed in rich handmade sauces and cheese',
    image: 'https://images.unsplash.com/photo-1621996346565-e3d5d62816ef?w=500',
    masterCat: 'Pizzas & Italian',
    items: [
      { name: 'Red Sauce Pasta', desc: 'Penne pasta in tangy spicy tomato basil arrabbiata sauce (रेड सॉस पास्ता)', price: 80 },
      { name: 'White Sauce Pasta', desc: 'Creamy Alfredo penne pasta with garlic and parmesan (व्हाइट सॉस पास्ता)', price: 90 },
      { name: 'Pink Sauce Pasta', desc: 'Delightful blend of tomato and creamy white sauce (पिंक सॉस पास्ता)', price: 100 },
      { name: 'Masala Pasta', desc: 'Desi style spiced pasta with onions & chilies (मसाला पास्ता)', price: 80 },
      { name: 'Gravy Pasta', desc: 'Saucy pasta rich in savory vegetable broth (ग्रेवी पास्ता)', price: 80 },
      { name: 'Cheese Pasta', desc: 'Super cheesy penne pasta baked with mozzarella (चीज पास्ता)', price: 90 },
    ],
  },
];

async function main() {
  console.log('--- Seeding Golden Cafe (Fast Batched Version) ---');

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

  const phone = '6350449827';
  const email = 'goldencafe.sangod@gmail.com';
  const password = 'GoldenCafe@123';
  const passwordHash = await bcrypt.hash(password, 10);

  // 1. User
  console.log('1. User setup...');
  let [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.phone, phone), eq(users.role, 'vendor')))
    .limit(1);

  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        phone,
        email,
        name: 'Aaditya & Himanshu (Golden Cafe)',
        role: 'vendor',
        status: 'active',
        passwordHash,
        mustChangePassword: false,
      })
      .returning();
  } else {
    [user] = await db
      .update(users)
      .set({
        name: 'Aaditya & Himanshu (Golden Cafe)',
        email,
        status: 'active',
        passwordHash,
      })
      .where(eq(users.id, user.id))
      .returning();
  }

  // 2. Vendor
  console.log('2. Vendor setup...');
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
        businessName: 'Golden Cafe',
        ownerName: 'Aaditya & Himanshu',
        type: 'both',
        shopAddress: 'Narsiya Ji Bypass, Kota Road, Sangod, Rajasthan 325601',
        pickupLat: 24.9195,
        pickupLng: 76.2805,
        radiusKm: 2000,
        kycStatus: 'verified',
        isOpen: true,
      })
      .returning();
  } else {
    [vendor] = await db
      .update(vendors)
      .set({
        businessName: 'Golden Cafe',
        ownerName: 'Aaditya & Himanshu',
        type: 'both',
        shopAddress: 'Narsiya Ji Bypass, Kota Road, Sangod, Rajasthan 325601',
        pickupLat: 24.9195,
        pickupLng: 76.2805,
        radiusKm: 2000,
        kycStatus: 'verified',
        isOpen: true,
      })
      .where(eq(vendors.id, vendor.id))
      .returning();
  }

  // 3. Restaurant
  console.log('3. Restaurant setup...');
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
        name: 'Golden Cafe',
        cuisineTags: 'North Indian, Chinese, Fast Food, Thali, Cafe, Beverages',
        imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800',
        ratingAvg: 4.8,
        isOpen: true,
      })
      .returning();
  } else {
    [restaurant] = await db
      .update(restaurants)
      .set({
        name: 'Golden Cafe',
        cuisineTags: 'North Indian, Chinese, Fast Food, Thali, Cafe, Beverages',
        imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800',
        ratingAvg: 4.8,
        isOpen: true,
      })
      .where(eq(restaurants.id, restaurant.id))
      .returning();
  }

  // 4. Clean up old restaurant menu items for clean refresh
  console.log('4. Cleaning old menu items...');
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
      await db.delete(menuItems).where(inArray(menuItems.id, existingItemIds));
    }
    await db.delete(menuCategories).where(inArray(menuCategories.id, existingCatIds));
  }

  // 5. Ensure Master Categories
  console.log('5. Ensuring Master Categories...');
  const masterCatNames = Array.from(new Set(GOLDEN_CAFE_DATA.map((c) => c.masterCat)));
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
      const sample = GOLDEN_CAFE_DATA.find((c) => c.masterCat === name);
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

  // 6. Batch insert Restaurant Menu Categories
  console.log('6. Batch inserting Menu Categories...');
  const catRows = GOLDEN_CAFE_DATA.map((c, idx) => ({
    restaurantId: restaurant.id,
    name: c.category,
    sortOrder: idx + 1,
  }));
  const insertedCats = await db.insert(menuCategories).values(catRows).returning();
  const menuCatMap = new Map<string, string>();
  for (const c of insertedCats) {
    menuCatMap.set(c.name, c.id);
  }

  // 7. Prepare Batch Menu Items & Master Products
  console.log('7. Preparing Menu Items, Variants & Products...');
  const menuItemsBatch: any[] = [];
  const metaList: any[] = [];

  for (const catSpec of GOLDEN_CAFE_DATA) {
    const catId = menuCatMap.get(catSpec.category)!;
    const masterCategoryId = masterCatMap.get(catSpec.masterCat)!;

    for (const itemSpec of catSpec.items) {
      const isHalfFull = itemSpec.half !== undefined && itemSpec.full !== undefined;
      const isPieces = itemSpec.pcs6 !== undefined && itemSpec.pcs12 !== undefined;
      const basePrice = isHalfFull ? itemSpec.half! : isPieces ? itemSpec.pcs6! : (itemSpec.price ?? 50);
      const mrpPrice = isHalfFull ? itemSpec.full! : isPieces ? itemSpec.pcs12! : basePrice;

      menuItemsBatch.push({
        menuCategoryId: catId,
        name: itemSpec.name,
        description: itemSpec.desc,
        price: basePrice,
        imageUrl: catSpec.image,
        isVeg: true,
        isAvailable: true,
      });

      metaList.push({
        name: itemSpec.name,
        desc: itemSpec.desc,
        image: catSpec.image,
        masterCategoryId,
        basePrice,
        mrpPrice,
        isHalfFull,
        isPieces,
        half: itemSpec.half,
        full: itemSpec.full,
        pcs6: itemSpec.pcs6,
        pcs12: itemSpec.pcs12,
        unit: itemSpec.unit ?? (isHalfFull ? '1 plate (Half/Full)' : isPieces ? '1 plate (6/12 pcs)' : '1 portion'),
        size: isHalfFull ? 'Half / Full' : isPieces ? '6 / 12 pcs' : 'Standard',
      });
    }
  }

  // Insert Menu Items in batches of 50
  console.log(`8. Batch inserting ${menuItemsBatch.length} Menu Items...`);
  const insertedMenuItems: any[] = [];
  for (let i = 0; i < menuItemsBatch.length; i += 50) {
    const chunk = menuItemsBatch.slice(i, i + 50);
    const res = await db.insert(menuItems).values(chunk).returning();
    insertedMenuItems.push(...res);
  }

  // 8. Batch Insert Variants
  console.log('9. Batch inserting Variants...');
  const variantsBatch: any[] = [];
  for (let i = 0; i < insertedMenuItems.length; i++) {
    const mItem = insertedMenuItems[i];
    const meta = metaList[i];
    if (meta.isHalfFull) {
      variantsBatch.push(
        { menuItemId: mItem.id, name: 'Half', priceDelta: 0, isDefault: true },
        { menuItemId: mItem.id, name: 'Full', priceDelta: meta.full! - meta.half!, isDefault: false },
      );
    } else if (meta.isPieces) {
      variantsBatch.push(
        { menuItemId: mItem.id, name: '6 Pieces', priceDelta: 0, isDefault: true },
        { menuItemId: mItem.id, name: '12 Pieces', priceDelta: meta.pcs12! - meta.pcs6!, isDefault: false },
      );
    }
  }

  for (let i = 0; i < variantsBatch.length; i += 50) {
    await db.insert(menuItemVariants).values(variantsBatch.slice(i, i + 50));
  }

  // Restaurant dishes belong in menu_items, not master grocery products.
  console.log('Skipping master grocery products insertion for restaurant dishes.');

  console.log(`\n================ SUCCESS ===============`);
  console.log(`Vendor: ${vendor.businessName} (${vendor.id})`);
  console.log(`Phone: ${phone} | Password: ${password}`);
  console.log(`Restaurant: ${restaurant.name} (${restaurant.id})`);
  console.log(`Menu Categories created: ${GOLDEN_CAFE_DATA.length}`);
  console.log(`Menu Items created: ${insertedMenuItems.length}`);
  console.log(`Menu Item Variants created: ${variantsBatch.length}`);
  console.log(`Master Products created/linked: ${allGoldenProds.length}`);
  console.log(`Vendor Products linked: ${vendorProdRows.length}`);
  console.log(`=========================================\n`);

  await client.end();
}

main().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});

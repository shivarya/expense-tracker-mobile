import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Category } from '../types/transactions';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface CategoryPickerModalProps {
  visible: boolean;
  onClose: () => void;
  categories: Category[];
  onSelect: (categoryId: number) => void;
  currentCategoryId?: number;
}

const CategoryPickerModal: React.FC<CategoryPickerModalProps> = ({
  visible,
  onClose,
  categories,
  onSelect,
  currentCategoryId,
}) => {
  const { colors, isDark } = useTheme();

  const renderCategory = ({ item }: { item: Category }) => {
    const isSelected = item.id === currentCategoryId;
    return (
      <TouchableOpacity
        style={[
          styles.categoryRow,
          {
            backgroundColor: isSelected
              ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)')
              : 'transparent',
          },
        ]}
        activeOpacity={0.6}
        onPress={() => onSelect(item.id)}
      >
        <View style={[styles.iconCircle, { backgroundColor: item.color + '22' }]}>
          <Ionicons
            name={(item.icon || 'help-circle-outline') as any}
            size={20}
            color={item.color || colors.textSecondary}
          />
        </View>
        <View style={styles.categoryInfo}>
          <Text style={[styles.categoryName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.categoryType, { color: colors.textSecondary }]}>
            {item.type?.charAt(0).toUpperCase() + item.type?.slice(1)}
          </Text>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? '#1A1A1A' : '#fff',
              maxHeight: SCREEN_HEIGHT * 0.65,
            },
          ]}
        >
          {/* Handle bar */}
          <View style={styles.handleBarWrap}>
            <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
          </View>

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Choose Category</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close-circle" size={26} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Category List */}
          <FlatList
            data={categories}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderCategory}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => (
              <View style={[styles.separator, { backgroundColor: colors.divider }]} />
            )}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
  },
  handleBarWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  categoryType: {
    fontSize: 11,
    marginTop: 1,
  },
  separator: {
    height: 1,
    marginLeft: 64,
  },
});

export default CategoryPickerModal;

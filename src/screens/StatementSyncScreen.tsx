import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import ApiService from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { StatementUploadResult } from '../types/transactions';

type SupportedBank = 'sbi' | 'icici' | 'hdfc';

const getAccountTypeForBank = (bank: SupportedBank): 'credit_card' | 'savings' =>
  bank === 'hdfc' ? 'savings' : 'credit_card';

const getApiErrorMessage = (error: any, fallback: string): string => {
  const serverMessage = error?.response?.data?.error;
  if (typeof serverMessage === 'string' && serverMessage.trim().length > 0) {
    return serverMessage;
  }

  return error?.message || fallback;
};

const StatementSyncScreen = () => {
  const { colors } = useTheme();
  const { refreshAll } = useData();

  const [selectedBank, setSelectedBank] = useState<SupportedBank>('sbi');
  const [cardLastFour, setCardLastFour] = useState('');
  const [statementPassword, setStatementPassword] = useState('');
  const [hasSavedPassword, setHasSavedPassword] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [syncResult, setSyncResult] = useState<StatementUploadResult | null>(null);

  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isRemovingPassword, setIsRemovingPassword] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const selectedAccountType = getAccountTypeForBank(selectedBank);
  const isCardBank = selectedAccountType === 'credit_card';

  const trimmedCardLastFour = useMemo(() => {
    const digits = cardLastFour.replace(/\D+/g, '');
    return digits.slice(-4);
  }, [cardLastFour]);

  const hasPartialCardDigits = useMemo(() => {
    if (!isCardBank) {
      return false;
    }
    const digits = cardLastFour.replace(/\D+/g, '');
    return digits.length > 0 && digits.length < 4;
  }, [cardLastFour, isCardBank]);

  const handlePickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset) {
        Alert.alert('No file selected', 'Please choose a statement PDF file.');
        return;
      }

      setSelectedFile(asset);
      setSyncResult(null);
    } catch (error: any) {
      Alert.alert('File picker error', error?.message || 'Unable to open file picker.');
    }
  };

  const handleSavePassword = async () => {
    if (hasPartialCardDigits) {
      Alert.alert('Invalid card digits', 'Enter exactly 4 digits or leave it empty.');
      return;
    }

    if (statementPassword.trim().length === 0) {
      Alert.alert('Password required', 'Please enter the statement PDF password.');
      return;
    }

    try {
      setIsSavingPassword(true);
      await ApiService.saveStatementPassword({
        bank: selectedBank,
        account_type: selectedAccountType,
        card_last_four: isCardBank ? trimmedCardLastFour : '',
        password: statementPassword,
      });
      setHasSavedPassword(true);
      setStatementPassword('');
      Alert.alert('Saved', 'Statement password stored securely on server.');
    } catch (error: any) {
      Alert.alert('Save failed', getApiErrorMessage(error, 'Unable to save statement password.'));
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleRemovePassword = async () => {
    if (hasPartialCardDigits) {
      Alert.alert('Invalid card digits', 'Enter exactly 4 digits or leave it empty.');
      return;
    }

    const removeMessage = isCardBank && trimmedCardLastFour.length === 4
      ? 'This will remove the stored statement password for this card.'
      : 'This will remove all saved statement passwords for this bank.';

    Alert.alert('Remove saved password', removeMessage, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsRemovingPassword(true);
            await ApiService.deleteStatementPassword({
              bank: selectedBank,
              account_type: selectedAccountType,
              card_last_four: isCardBank ? trimmedCardLastFour : '',
            });
            setHasSavedPassword(false);
            Alert.alert('Removed', 'Saved statement password was removed.');
          } catch (error: any) {
            Alert.alert('Remove failed', getApiErrorMessage(error, 'Unable to remove statement password.'));
          } finally {
            setIsRemovingPassword(false);
          }
        },
      },
    ]);
  };

  const handleUpload = async () => {
    if (hasPartialCardDigits) {
      Alert.alert('Invalid card digits', 'Enter exactly 4 digits or leave it empty.');
      return;
    }

    if (!selectedFile?.uri || !selectedFile?.name) {
      Alert.alert('PDF required', 'Please pick a statement PDF file first.');
      return;
    }

    try {
      setIsUploading(true);
      setSyncResult(null);

      const result = await ApiService.uploadStatementPdf({
        bank: selectedBank,
        account_type: selectedAccountType,
        card_last_four: isCardBank ? trimmedCardLastFour : '',
        fileUri: selectedFile.uri,
        fileName: selectedFile.name,
        mimeType: selectedFile.mimeType || 'application/pdf',
      });

      setSyncResult(result);
      await refreshAll();

      const title = result.duplicate_upload ? 'Already synced' : 'Statement synced';
      const message = [
        `Extracted: ${result.extracted_transactions}`,
        `Saved: ${result.saved_transactions}`,
        `Skipped high confidence: ${result.skipped_high_confidence}`,
        `Flagged possible duplicates: ${result.flagged_possible_duplicates}`,
      ].join('\n');

      Alert.alert(title, message);
    } catch (error: any) {
      Alert.alert('Upload failed', getApiErrorMessage(error, 'Unable to process statement PDF.'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.section, { backgroundColor: colors.card }]}> 
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Statement Sync</Text>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>Upload a password-protected SBI or ICICI credit card statement, or an HDFC savings account statement PDF. New transactions are synced and high-confidence duplicates are skipped.</Text>

        <View style={styles.bankSelectorRow}>
          {(['sbi', 'icici', 'hdfc'] as SupportedBank[]).map((bank) => {
            const isSelected = selectedBank === bank;
            return (
              <TouchableOpacity
                key={bank}
                style={[
                  styles.bankChip,
                  {
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primary : colors.background,
                  },
                ]}
                onPress={() => {
                  setSelectedBank(bank);
                  setHasSavedPassword(false);
                  setSyncResult(null);
                }}
              >
                <Text style={[styles.bankChipText, { color: isSelected ? colors.background : colors.text }]}>
                  {bank.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isCardBank && (
          <>
            <Text style={[styles.label, { color: colors.text }]}>Card Last 4 Digits (Optional)</Text>
            <TextInput
              value={cardLastFour}
              onChangeText={setCardLastFour}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="Optional - e.g. 6529"
              placeholderTextColor={colors.placeholder}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            />
          </>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: colors.card }]}> 
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Secure Password Setup</Text>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          {isCardBank
            ? `Save password once on the server vault. If card last 4 digits is empty, upload will try all saved passwords for ${selectedBank.toUpperCase()}.`
            : `Save your HDFC net banking / SmartStatement password once on the server vault.`}
        </Text>

        <TextInput
          value={statementPassword}
          onChangeText={setStatementPassword}
          secureTextEntry
          placeholder="Statement PDF password"
          placeholderTextColor={colors.placeholder}
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
        />

        <View style={styles.rowButtons}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: isSavingPassword ? 0.7 : 1 }]}
            disabled={isSavingPassword}
            onPress={handleSavePassword}
          >
            {isSavingPassword ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <>
                <Ionicons name="lock-closed-outline" size={18} color={colors.background} />
                <Text style={[styles.primaryButtonText, { color: colors.background }]}>Save Password</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.border, opacity: isRemovingPassword ? 0.7 : 1 }]}
            disabled={isRemovingPassword}
            onPress={handleRemovePassword}
          >
            {isRemovingPassword ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color={colors.text} />
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Remove</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={[styles.hint, { color: hasSavedPassword ? colors.success : colors.textSecondary }]}>
          {hasSavedPassword
            ? `${selectedBank.toUpperCase()} password saved in this session.`
            : `Save one or more ${selectedBank.toUpperCase()} passwords before uploading statement PDF.`}
        </Text>
      </View>

      <View style={[styles.section, { backgroundColor: colors.card }]}> 
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Upload Statement PDF</Text>

        <TouchableOpacity
          style={[styles.filePickerButton, { borderColor: colors.border, backgroundColor: colors.background }]}
          onPress={handlePickPdf}
        >
          <Ionicons name="document-outline" size={20} color={colors.text} />
          <Text style={[styles.filePickerText, { color: colors.text }]}>
            {selectedFile ? selectedFile.name : 'Select PDF file'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.uploadButton, { backgroundColor: colors.primary, opacity: isUploading ? 0.7 : 1 }]}
          onPress={handleUpload}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={20} color={colors.background} />
              <Text style={[styles.uploadButtonText, { color: colors.background }]}>Upload and Sync</Text>
            </>
          )}
        </TouchableOpacity>

        {syncResult && (
          <View style={[styles.resultCard, { borderColor: colors.border, backgroundColor: colors.background }]}> 
            <Text style={[styles.resultTitle, { color: colors.text }]}>Last Sync Result</Text>
            <Text style={[styles.resultLine, { color: colors.textSecondary }]}>Extracted: {syncResult.extracted_transactions}</Text>
            <Text style={[styles.resultLine, { color: colors.textSecondary }]}>Saved: {syncResult.saved_transactions}</Text>
            <Text style={[styles.resultLine, { color: colors.textSecondary }]}>Skipped (high confidence): {syncResult.skipped_high_confidence}</Text>
            <Text style={[styles.resultLine, { color: colors.textSecondary }]}>Flagged possible duplicates: {syncResult.flagged_possible_duplicates}</Text>
            {syncResult.errors && syncResult.errors.length > 0 && (
              <Text style={[styles.resultLine, { color: colors.warning }]}>Parser notes: {syncResult.errors.slice(0, 2).join(' | ')}</Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  bankSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bankChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  bankChipText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    minWidth: 110,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
  },
  filePickerButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  filePickerText: {
    fontSize: 14,
    flexShrink: 1,
  },
  uploadButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  resultCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  resultLine: {
    fontSize: 13,
  },
});

export default StatementSyncScreen;

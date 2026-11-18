export function countSocialCopyCharacters(copy: string) {
  return [...copy].length;
}

export function exceedsSocialCopyLimit(copy: string, maximum: number | null | undefined) {
  return maximum !== null && maximum !== undefined && countSocialCopyCharacters(copy) > maximum;
}

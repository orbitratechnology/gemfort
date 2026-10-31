Pod::Spec.new do |s|
  s.name           = 'TextRecognition'
  s.version        = '1.0.0'
  s.summary        = 'On-device text recognition (Apple Vision)'
  s.description    = 'Offline OCR for scanned documents using VNRecognizeTextRequest'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end

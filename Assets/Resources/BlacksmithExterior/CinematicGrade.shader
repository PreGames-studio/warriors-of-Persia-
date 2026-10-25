Shader "Hidden/WarriorsOfPersia/CinematicGrade"
{
    Properties
    {
        _MainTex ("Source", 2D) = "white" {}
        _Exposure ("Exposure", Float) = 1.08
        _Contrast ("Contrast", Float) = 1.055
        _Saturation ("Saturation", Float) = 1.045
        _Vignette ("Vignette", Float) = 0.13
        _AOStrength ("AO Strength", Float) = 0.24
        _AOEnabled ("AO Enabled", Float) = 0
    }
    SubShader
    {
        Cull Off ZWrite Off ZTest Always
        Pass
        {
            CGPROGRAM
            #pragma vertex vert_img
            #pragma fragment frag
            #include "UnityCG.cginc"

            sampler2D _MainTex;
            sampler2D _CameraDepthTexture;
            float4 _MainTex_TexelSize;
            float _Exposure;
            float _Contrast;
            float _Saturation;
            float _Vignette;
            float _AOStrength;
            float _AOEnabled;

            float DepthAO(float2 uv)
            {
                if (_AOEnabled < .5) return 1.0;
                float center = LinearEyeDepth(SAMPLE_DEPTH_TEXTURE(_CameraDepthTexture, uv));
                if (center > 150.0) return 1.0;
                float2 radius = _MainTex_TexelSize.xy * 2.0;
                float occlusion = 0.0;
                float2 sampleUv = saturate(uv + float2(radius.x, 0));
                occlusion += saturate((center - LinearEyeDepth(SAMPLE_DEPTH_TEXTURE(_CameraDepthTexture, sampleUv))) * .28 - .035);
                sampleUv = saturate(uv - float2(radius.x, 0));
                occlusion += saturate((center - LinearEyeDepth(SAMPLE_DEPTH_TEXTURE(_CameraDepthTexture, sampleUv))) * .28 - .035);
                sampleUv = saturate(uv + float2(0, radius.y));
                occlusion += saturate((center - LinearEyeDepth(SAMPLE_DEPTH_TEXTURE(_CameraDepthTexture, sampleUv))) * .28 - .035);
                sampleUv = saturate(uv - float2(0, radius.y));
                occlusion += saturate((center - LinearEyeDepth(SAMPLE_DEPTH_TEXTURE(_CameraDepthTexture, sampleUv))) * .28 - .035);
                return saturate(1.0 - occlusion * _AOStrength * .25);
            }

            fixed4 frag(v2f_img input) : SV_Target
            {
                float3 color = tex2D(_MainTex, input.uv).rgb * DepthAO(input.uv);
                color *= _Exposure;
                // A compact ACES-style curve preserves warm forge highlights
                // without clipping all stone detail into white.
                color = (color * (2.51 * color + .03)) /
                        (color * (2.43 * color + .59) + .14);
                color = saturate(color);
                float luma = dot(color, float3(.2126, .7152, .0722));
                color = lerp(luma.xxx, color, _Saturation);
                color = (color - .5) * _Contrast + .5;
                float2 centered = input.uv * 2.0 - 1.0;
                color *= saturate(1.0 - dot(centered, centered) * _Vignette);
                return fixed4(saturate(color), 1.0);
            }
            ENDCG
        }
    }
    Fallback Off
}
